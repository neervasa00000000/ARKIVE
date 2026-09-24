import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

public final class E14Recovery {
    private static final Path FIXTURE = Path.of("fixture/passphrase-v1.arkive");
    private static final Path VECTORS = Path.of("conformance/vectors.json");
    private static final int MAX_HEADER = 65_536;
    private static final int MAX_BUNDLE = 140 * 1024 * 1024;

    static final class Failure extends Exception {
        final String code;
        Failure(String code, String message) { super(message); this.code = code; }
    }

    record Bundle(Map<String, Object> header, byte[] headerBytes, byte[] ciphertext) {}
    record Recovery(byte[] plaintext, Map<String, Object> metadata, byte[] fileKey) {}

    public static void main(String[] args) throws Exception {
        long started = System.nanoTime();
        Map<String, Object> vectors = object(new Json(Files.readString(VECTORS)).parse());
        byte[] archive = Files.readAllBytes(FIXTURE);
        List<Map<String, Object>> tests = new ArrayList<>();

        Map<String, Object> framing = object(vectors.get("framing"));
        Bundle bundle = parseBundle(archive);
        check(tests, "framing.archiveBytes", archive.length == integer(framing.get("archiveBytes")), hex(sha256(archive)), string(framing.get("archiveSha256")));
        check(tests, "framing.magic", hex(slice(archive, 0, 4)).equals(string(framing.get("magicHex"))), hex(slice(archive, 0, 4)), string(framing.get("magicHex")));
        check(tests, "framing.version", (archive[4] & 0xff) == integer(framing.get("version")), archive[4] & 0xff, integer(framing.get("version")));
        check(tests, "framing.headerLength", bundle.headerBytes.length == integer(framing.get("headerLength")), bundle.headerBytes.length, integer(framing.get("headerLength")));
        check(tests, "framing.headerSha256", hex(sha256(bundle.headerBytes)).equals(string(framing.get("headerSha256"))), hex(sha256(bundle.headerBytes)), string(framing.get("headerSha256")));
        check(tests, "framing.ciphertextBytes", bundle.ciphertext.length == integer(framing.get("ciphertextBytesIncludingTag")), bundle.ciphertext.length, integer(framing.get("ciphertextBytesIncludingTag")));
        check(tests, "framing.ciphertextSha256", hex(sha256(bundle.ciphertext)).equals(string(framing.get("ciphertextSha256"))), hex(sha256(bundle.ciphertext)), string(framing.get("ciphertextSha256")));

        Map<String, Object> enc = object(vectors.get("passphraseEncodingVectors"));
        byte[] vectorSalt = unhex(string(enc.get("saltHex")));
        int vectorIterations = integer(enc.get("iterations"));
        for (Object raw : array(enc.get("cases"))) {
            Map<String, Object> c = object(raw);
            String id = string(c.get("id"));
            String text = string(c.get("text"));
            byte[] utf8 = text.getBytes(StandardCharsets.UTF_8);
            check(tests, "unicode." + id + ".utf8", hex(utf8).equals(string(c.get("utf8Hex"))), hex(utf8), string(c.get("utf8Hex")));
            check(tests, "unicode." + id + ".utf16CodeUnits", text.length() == integer(c.get("utf16CodeUnits")), text.length(), integer(c.get("utf16CodeUnits")));
            String derived = hex(pbkdf2(utf8, vectorSalt, vectorIterations, 32));
            check(tests, "pbkdf2." + id, derived.equals(string(c.get("derivedKeyHex"))), derived, string(c.get("derivedKeyHex")));
        }

        Map<String, Object> fixture = object(vectors.get("fixtureRecovery"));
        String passphrase = string(fixture.get("testOnlyPassphrase"));
        Recovery recovery = recover(archive, passphrase);
        Files.write(Path.of("E14-recovered.bin"), recovery.plaintext);
        check(tests, "recovery.fileKey", hex(recovery.fileKey).equals(string(fixture.get("fileKeyHex"))), hex(recovery.fileKey), string(fixture.get("fileKeyHex")));
        check(tests, "recovery.plaintextBytes", recovery.plaintext.length == integer(fixture.get("plaintextBytes")), recovery.plaintext.length, integer(fixture.get("plaintextBytes")));
        check(tests, "recovery.plaintextSha256", hex(sha256(recovery.plaintext)).equals(string(fixture.get("plaintextSha256"))), hex(sha256(recovery.plaintext)), string(fixture.get("plaintextSha256")));
        byte[] metadataBytes = decrypt(
                recovery.fileKey,
                decodeB64(string(bundle.header.get("encryptedMetadataIv"))),
                decodeB64(string(bundle.header.get("encryptedMetadata"))));
        check(tests, "recovery.metadataExactVectorBytes", new String(metadataBytes, StandardCharsets.UTF_8).equals(string(fixture.get("metadataPlaintextUtf8"))), new String(metadataBytes, StandardCharsets.UTF_8), string(fixture.get("metadataPlaintextUtf8")));
        check(tests, "recovery.metadataSha256", hex(sha256(metadataBytes)).equals(string(fixture.get("metadataSha256"))), hex(sha256(metadataBytes)), string(fixture.get("metadataSha256")));

        expectFailure(tests, "negative.wrong-passphrase", "WRONG_CREDENTIAL_OR_CORRUPT_KEY_WRAP", () -> recover(archive, "wrong passphrase"));
        byte[] corrupt = archive.clone();
        corrupt[corrupt.length - 1] ^= 1;
        expectFailure(tests, "negative.ciphertext-corruption", "CONTENT_HASH_MISMATCH", () -> recover(corrupt, passphrase));
        byte[] unsupported = archive.clone();
        unsupported[4] = 4;
        expectFailure(tests, "negative.unsupported-version", "UNSUPPORTED_BUNDLE_VERSION", () -> recover(unsupported, passphrase));

        boolean allPassed = tests.stream().allMatch(t -> Boolean.TRUE.equals(t.get("passed")));
        int sourceLines = Files.readAllLines(Path.of("E14Recovery.java")).size();
        long sourceBytes = Files.size(Path.of("E14Recovery.java"));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("exercise", "E14 Blind Specification-Only Recovery Reimplementation");
        result.put("status", allPassed ? "PASS" : "FAIL");
        result.put("completedAt", Instant.now().toString());
        result.put("durationMilliseconds", (System.nanoTime() - started) / 1_000_000);
        result.put("language", "Java");
        result.put("runtimeVersion", System.getProperty("java.version"));
        result.put("cryptoLibraries", List.of("Java built-in JCA: HmacSHA256, SHA-256, AES/GCM/NoPadding"));
        result.put("tests", tests);
        result.put("testSummary", Map.of("passed", tests.stream().filter(t -> Boolean.TRUE.equals(t.get("passed"))).count(), "total", tests.size()));
        result.put("implementationSize", Map.of("sourceFiles", 1, "sourceLines", sourceLines, "sourceBytes", sourceBytes));
        result.put("recoveredArtifact", Map.of("path", "E14-recovered.bin", "bytes", recovery.plaintext.length, "sha256", hex(sha256(recovery.plaintext))));
        result.put("exactByteStatus", Map.of(
                "status", "UNAVAILABLE",
                "reason", "The original plaintext is not supplied as an independent evidence file; equality can only be checked against supplied length and SHA-256 vectors.",
                "vectorLengthMatch", recovery.plaintext.length == integer(fixture.get("plaintextBytes")),
                "vectorSha256Match", hex(sha256(recovery.plaintext)).equals(string(fixture.get("plaintextSha256")))));
        result.put("ambiguities", List.of(Map.of(
                "topic", "Encrypted metadata JSON field order",
                "blocking", false,
                "resolution", "Parsed by field name as explicitly required; exact decrypted vector bytes preserve the fixture order.")));
        Files.writeString(Path.of("E14-RESULT.json"), Json.write(result) + "\n", StandardCharsets.UTF_8);
        if (!allPassed) throw new IllegalStateException("Conformance failure; see E14-RESULT.json");
    }

    static Recovery recover(byte[] archive, String passphrase) throws Exception {
        Bundle bundle = parseBundle(archive);
        Map<String, Object> h = bundle.header;
        require("ARKIVE_VAULT_BUNDLE_V3".equals(h.get("schema")), "INVALID_SCHEMA", "Unsupported schema");
        require("1".equals(h.get("recoverySpecVersion")), "UNSUPPORTED_RECOVERY_SPEC", "Unsupported recovery specification");
        String contentHash = string(h.get("contentHash"));
        require(contentHash.matches("[0-9a-f]{64}"), "INVALID_CONTENT_HASH", "Malformed content hash");
        require(MessageDigest.isEqual(unhex(contentHash), sha256(bundle.ciphertext)), "CONTENT_HASH_MISMATCH", "Ciphertext hash mismatch");

        Map<String, Object> wrap = object(h.get("recoveryWrap"));
        require("passphrase-v1".equals(wrap.get("method")), "UNSUPPORTED_WRAP_METHOD", "Unsupported recovery wrap");
        int iterations = integerStrict(wrap.get("iterations"), "INVALID_KDF_PARAMETERS");
        require(iterations >= 100_000 && iterations <= 1_000_000, "INVALID_KDF_PARAMETERS", "PBKDF2 iteration count out of range");
        byte[] salt = decodeB64(string(wrap.get("salt")));
        byte[] wrapIv = decodeB64(string(wrap.get("iv")));
        byte[] wrapped = decodeB64(string(wrap.get("encryptedAesKey")));
        require(salt.length == 16 && wrapIv.length == 12 && wrapped.length == 48, "INVALID_WRAP_PARAMETERS", "Invalid wrap byte lengths");
        require(passphrase.length() <= 1024, "INVALID_PASSPHRASE", "Passphrase exceeds 1024 UTF-16 code units");
        byte[] wrappingKey = pbkdf2(passphrase.getBytes(StandardCharsets.UTF_8), salt, iterations, 32);
        byte[] fileKey;
        try {
            fileKey = decrypt(wrappingKey, wrapIv, wrapped);
        } catch (AEADBadTagException e) {
            throw new Failure("WRONG_CREDENTIAL_OR_CORRUPT_KEY_WRAP", "Key wrap authentication failed");
        }
        require(fileKey.length == 32, "INVALID_FILE_KEY", "Unwrapped file key is not 32 bytes");

        byte[] fileIv = decodeB64(string(h.get("encryptedFileIv")));
        require(fileIv.length == 12, "INVALID_FILE_IV", "Invalid content IV length");
        byte[] plaintext;
        try {
            plaintext = decrypt(fileKey, fileIv, bundle.ciphertext);
        } catch (AEADBadTagException e) {
            throw new Failure("CONTENT_AUTHENTICATION_FAILED", "Content authentication failed");
        }

        byte[] metadataIv = decodeB64(string(h.get("encryptedMetadataIv")));
        byte[] encryptedMetadata = decodeB64(string(h.get("encryptedMetadata")));
        require(metadataIv.length == 12 && encryptedMetadata.length >= 16, "INVALID_METADATA_PARAMETERS", "Invalid metadata byte lengths");
        byte[] metadataBytes;
        try {
            metadataBytes = decrypt(fileKey, metadataIv, encryptedMetadata);
        } catch (AEADBadTagException e) {
            throw new Failure("METADATA_AUTHENTICATION_FAILED", "Metadata authentication failed");
        }
        Object parsedMetadata;
        try {
            parsedMetadata = new Json(new String(metadataBytes, StandardCharsets.UTF_8)).parse();
        } catch (RuntimeException e) {
            throw new Failure("INVALID_METADATA_JSON", e.getMessage());
        }
        require(parsedMetadata instanceof Map, "INVALID_METADATA_JSON", "Metadata is not an object");
        Map<String, Object> metadata = object(parsedMetadata);
        int originalSize = integerStrict(metadata.get("originalFileSize"), "INVALID_METADATA_SIZE");
        require(originalSize >= 0 && originalSize == plaintext.length, "PLAINTEXT_SIZE_MISMATCH", "Plaintext size mismatch");
        Object originalHashValue = metadata.get("originalContentHash");
        if (originalHashValue != null) {
            String originalHash = string(originalHashValue);
            require(originalHash.matches("[0-9a-f]{64}"), "INVALID_ORIGINAL_CONTENT_HASH", "Malformed plaintext hash");
            require(MessageDigest.isEqual(unhex(originalHash), sha256(plaintext)), "PLAINTEXT_HASH_MISMATCH", "Plaintext hash mismatch");
        }
        return new Recovery(plaintext, metadata, fileKey);
    }

    static Bundle parseBundle(byte[] archive) throws Exception {
        require(archive.length <= MAX_BUNDLE, "BUNDLE_TOO_LARGE", "Bundle exceeds resource limit");
        require(archive.length >= 9 + 16, "TRUNCATED_BUNDLE", "Bundle is too short");
        require(archive[0] == 'A' && archive[1] == 'R' && archive[2] == 'K' && archive[3] == 'V', "INVALID_MAGIC", "Invalid magic");
        int version = archive[4] & 0xff;
        require(version == 3, "UNSUPPORTED_BUNDLE_VERSION", "Unsupported bundle version " + version);
        long unsignedLength = Integer.toUnsignedLong(ByteBuffer.wrap(archive, 5, 4).order(ByteOrder.BIG_ENDIAN).getInt());
        require(unsignedLength >= 1 && unsignedLength <= MAX_HEADER, "INVALID_HEADER_LENGTH", "Header length out of range");
        long end = 9L + unsignedLength;
        require(end <= archive.length - 16L, "TRUNCATED_BUNDLE", "Header or ciphertext is truncated");
        byte[] headerBytes = slice(archive, 9, (int) unsignedLength);
        Object parsed;
        try {
            parsed = new Json(new String(headerBytes, StandardCharsets.UTF_8)).parse();
        } catch (RuntimeException e) {
            throw new Failure("INVALID_HEADER_JSON", e.getMessage());
        }
        require(parsed instanceof Map, "INVALID_HEADER_JSON", "Header is not an object");
        return new Bundle(object(parsed), headerBytes, slice(archive, (int) end, archive.length - (int) end));
    }

    static byte[] pbkdf2(byte[] password, byte[] salt, int iterations, int outputBytes) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(password, "HmacSHA256"));
        int hLen = mac.getMacLength();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (int block = 1; out.size() < outputBytes; block++) {
            mac.update(salt);
            byte[] u = mac.doFinal(ByteBuffer.allocate(4).putInt(block).array());
            byte[] t = u.clone();
            for (int i = 1; i < iterations; i++) {
                u = mac.doFinal(u);
                for (int j = 0; j < hLen; j++) t[j] ^= u[j];
            }
            out.write(t);
        }
        return slice(out.toByteArray(), 0, outputBytes);
    }

    static byte[] decrypt(byte[] key, byte[] iv, byte[] ciphertextAndTag) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
        return cipher.doFinal(ciphertextAndTag);
    }

    interface CheckedAction { void run() throws Exception; }

    static void expectFailure(List<Map<String, Object>> tests, String name, String expected, CheckedAction action) {
        String actual = "NO_FAILURE";
        try {
            action.run();
        } catch (Failure e) {
            actual = e.code;
        } catch (Exception e) {
            actual = e.getClass().getSimpleName();
        }
        check(tests, name, expected.equals(actual), actual, expected);
    }

    static void check(List<Map<String, Object>> tests, String name, boolean passed, Object actual, Object expected) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("name", name);
        item.put("passed", passed);
        item.put("actual", actual);
        item.put("expected", expected);
        tests.add(item);
    }

    static void require(boolean condition, String code, String message) throws Failure {
        if (!condition) throw new Failure(code, message);
    }

    static byte[] decodeB64(String value) throws Failure {
        try {
            if (!value.matches("(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?"))
                throw new IllegalArgumentException("non-canonical Base64");
            return Base64.getDecoder().decode(value);
        } catch (IllegalArgumentException e) {
            throw new Failure("INVALID_BASE64", "Malformed Base64");
        }
    }

    static byte[] sha256(byte[] bytes) throws Exception { return MessageDigest.getInstance("SHA-256").digest(bytes); }
    static byte[] slice(byte[] bytes, int offset, int length) {
        byte[] result = new byte[length];
        System.arraycopy(bytes, offset, result, 0, length);
        return result;
    }
    static String hex(byte[] bytes) {
        StringBuilder b = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) b.append(String.format("%02x", value & 0xff));
        return b.toString();
    }
    static byte[] unhex(String value) {
        if ((value.length() & 1) != 0) throw new IllegalArgumentException("odd hex length");
        byte[] out = new byte[value.length() / 2];
        for (int i = 0; i < out.length; i++) out[i] = (byte) Integer.parseInt(value.substring(i * 2, i * 2 + 2), 16);
        return out;
    }
    static String string(Object value) { if (!(value instanceof String s)) throw new IllegalArgumentException("Expected string"); return s; }
    static int integer(Object value) { return Math.toIntExact((Long) value); }
    static int integerStrict(Object value, String code) throws Failure {
        if (!(value instanceof Long n) || n < Integer.MIN_VALUE || n > Integer.MAX_VALUE) throw new Failure(code, "Expected integer");
        return n.intValue();
    }
    @SuppressWarnings("unchecked") static Map<String, Object> object(Object value) { if (!(value instanceof Map)) throw new IllegalArgumentException("Expected object"); return (Map<String, Object>) value; }
    @SuppressWarnings("unchecked") static List<Object> array(Object value) { if (!(value instanceof List)) throw new IllegalArgumentException("Expected array"); return (List<Object>) value; }

    static final class Json {
        private final String text;
        private int at;
        Json(String text) { this.text = text; }
        Object parse() { Object value = value(); ws(); if (at != text.length()) fail("Trailing JSON data"); return value; }
        Object value() {
            ws();
            if (at >= text.length()) return fail("Unexpected end of JSON");
            return switch (text.charAt(at)) {
                case '{' -> object(); case '[' -> array(); case '"' -> string();
                case 't' -> literal("true", true); case 'f' -> literal("false", false); case 'n' -> literal("null", null);
                default -> number();
            };
        }
        Map<String, Object> object() {
            Map<String, Object> map = new LinkedHashMap<>(); at++; ws();
            if (take('}')) return map;
            do { ws(); if (at >= text.length() || text.charAt(at) != '"') fail("Expected object key"); String key = string(); ws(); need(':'); map.put(key, value()); ws(); } while (take(','));
            need('}'); return map;
        }
        List<Object> array() {
            List<Object> list = new ArrayList<>(); at++; ws();
            if (take(']')) return list;
            do { list.add(value()); ws(); } while (take(','));
            need(']'); return list;
        }
        String string() {
            need('"'); StringBuilder b = new StringBuilder();
            while (at < text.length()) {
                char c = text.charAt(at++);
                if (c == '"') return b.toString();
                if (c == '\\') {
                    if (at >= text.length()) fail("Incomplete escape");
                    char e = text.charAt(at++);
                    switch (e) {
                        case '"', '\\', '/' -> b.append(e); case 'b' -> b.append('\b'); case 'f' -> b.append('\f');
                        case 'n' -> b.append('\n'); case 'r' -> b.append('\r'); case 't' -> b.append('\t');
                        case 'u' -> { if (at + 4 > text.length()) fail("Incomplete Unicode escape"); b.append((char) Integer.parseInt(text.substring(at, at + 4), 16)); at += 4; }
                        default -> fail("Invalid escape");
                    }
                } else { if (c < 0x20) fail("Control character in string"); b.append(c); }
            }
            return fail("Unterminated string");
        }
        Object number() {
            int start = at;
            if (take('-')) {}
            if (take('0')) { if (at < text.length() && Character.isDigit(text.charAt(at))) fail("Leading zero"); }
            else { if (at >= text.length() || text.charAt(at) < '1' || text.charAt(at) > '9') return fail("Expected value"); while (at < text.length() && Character.isDigit(text.charAt(at))) at++; }
            if (at < text.length() && (text.charAt(at) == '.' || text.charAt(at) == 'e' || text.charAt(at) == 'E')) return fail("Non-integer JSON number");
            try { return Long.parseLong(text.substring(start, at)); } catch (NumberFormatException e) { return fail("Unsafe or invalid integer"); }
        }
        Object literal(String token, Object value) { if (!text.startsWith(token, at)) return fail("Invalid literal"); at += token.length(); return value; }
        void ws() { while (at < text.length() && " \n\r\t".indexOf(text.charAt(at)) >= 0) at++; }
        boolean take(char c) { if (at < text.length() && text.charAt(at) == c) { at++; return true; } return false; }
        void need(char c) { if (!take(c)) fail("Expected " + c); }
        <T> T fail(String message) { throw new IllegalArgumentException(message + " at character " + at); }

        static String write(Object value) {
            if (value == null) return "null";
            if (value instanceof String s) return quote(s);
            if (value instanceof Number || value instanceof Boolean) return value.toString();
            if (value instanceof Map<?, ?> map) {
                StringBuilder b = new StringBuilder("{"); boolean first = true;
                for (Map.Entry<?, ?> e : map.entrySet()) { if (!first) b.append(','); first = false; b.append(quote(e.getKey().toString())).append(':').append(write(e.getValue())); }
                return b.append('}').toString();
            }
            if (value instanceof Iterable<?> iterable) {
                StringBuilder b = new StringBuilder("["); boolean first = true;
                for (Object item : iterable) { if (!first) b.append(','); first = false; b.append(write(item)); }
                return b.append(']').toString();
            }
            throw new IllegalArgumentException("Cannot serialize " + value.getClass());
        }
        static String quote(String s) {
            StringBuilder b = new StringBuilder("\"");
            for (char c : s.toCharArray()) switch (c) {
                case '"' -> b.append("\\\""); case '\\' -> b.append("\\\\"); case '\b' -> b.append("\\b"); case '\f' -> b.append("\\f");
                case '\n' -> b.append("\\n"); case '\r' -> b.append("\\r"); case '\t' -> b.append("\\t");
                default -> { if (c < 0x20) b.append(String.format("\\u%04x", (int) c)); else b.append(c); }
            }
            return b.append('"').toString();
        }
    }
}
