#!/usr/bin/env python3
import hashlib, json, struct, sys, tempfile
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "research/independent-recovery"))
from recover import RecoveryError, decrypt_archive

vectors = json.loads((ROOT / "research/conformance/vectors.json").read_text(encoding="utf-8"))
archive = (ROOT / vectors["framing"]["fixture"]).read_bytes()
framing = vectors["framing"]
assert archive[:4].hex() == framing["magicHex"]
assert archive[4] == framing["version"]
assert struct.unpack(">I", archive[5:9])[0] == framing["headerLength"]
header_raw = archive[9:framing["ciphertextOffset"]]
header = json.loads(header_raw.decode("utf-8"))
ciphertext = archive[framing["ciphertextOffset"]:]
assert hashlib.sha256(header_raw).hexdigest() == framing["headerSha256"]
assert hashlib.sha256(ciphertext).hexdigest() == framing["ciphertextSha256"]

pv = vectors["passphraseEncodingVectors"]
for item in pv["cases"]:
    encoded = item["text"].encode("utf-8")
    assert encoded.hex() == item["utf8Hex"], item["id"]
    assert len(item["text"].encode("utf-16-le")) // 2 == item["utf16CodeUnits"], item["id"]
    key = hashlib.pbkdf2_hmac("sha256", encoded, bytes.fromhex(pv["saltHex"]), pv["iterations"], 32)
    assert key.hex() == item["derivedKeyHex"], item["id"]
assert pv["cases"][3]["derivedKeyHex"] != pv["cases"][4]["derivedKeyHex"]

fixture = vectors["fixtureRecovery"]
wrapping_key = hashlib.pbkdf2_hmac("sha256", fixture["testOnlyPassphrase"].encode("utf-8"), bytes.fromhex(fixture["saltHex"]), fixture["iterations"], 32)
assert wrapping_key.hex() == fixture["derivedWrappingKeyHex"]
file_key = AESGCM(wrapping_key).decrypt(bytes.fromhex(fixture["wrapIvHex"]), bytes.fromhex(fixture["wrappedFileKeyAndTagHex"]), None)
assert file_key.hex() == fixture["fileKeyHex"]
metadata = AESGCM(file_key).decrypt(bytes.fromhex(fixture["metadataIvHex"]), __import__('base64').b64decode(header["encryptedMetadata"]), None)
assert metadata.decode("utf-8") == fixture["metadataPlaintextUtf8"]
assert hashlib.sha256(metadata).hexdigest() == fixture["metadataSha256"]
plaintext, _ = decrypt_archive(archive, fixture["testOnlyPassphrase"])
assert hashlib.sha256(plaintext).hexdigest() == fixture["plaintextSha256"]

negative = {}
for name, data, credential in [
    ("wrongCredential", archive, "wrong synthetic credential"),
    ("ciphertextCorruption", archive[:-1] + bytes([archive[-1] ^ 1]), fixture["testOnlyPassphrase"]),
    ("unsupportedVersion", archive[:4] + b"\x04" + archive[5:], fixture["testOnlyPassphrase"]),
]:
    try:
        decrypt_archive(data, credential)
        negative[name] = None
    except RecoveryError as error:
        negative[name] = str(error)
assert negative == {
    "wrongCredential": "WRONG_CREDENTIAL_OR_CORRUPT_KEY_WRAP",
    "ciphertextCorruption": "CONTENT_HASH_MISMATCH",
    "unsupportedVersion": "UNSUPPORTED_BUNDLE_VERSION",
}
print(json.dumps({"implementation": "independent Python", "deterministicVectors": "PASS", "archiveRecovery": "PASS", "negativeVectors": negative, "plaintextSha256": hashlib.sha256(plaintext).hexdigest(), "result": "PASS"}))
