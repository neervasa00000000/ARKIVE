#!/usr/bin/env python3
"""Independent ARKIVE v3/passphrase-v1 recovery from the public specification."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import struct
import sys
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


MAGIC = b"ARKV"
BUNDLE_VERSION = 3
SCHEMA = "ARKIVE_VAULT_BUNDLE_V3"
SPEC_VERSION = "1"
MAX_HEADER_BYTES = 1024 * 1024


class RecoveryError(Exception):
    pass


def decode64(value: object, field: str) -> bytes:
    if not isinstance(value, str):
        raise RecoveryError(f"INVALID_{field.upper()}")
    try:
        return base64.b64decode(value, validate=True)
    except (ValueError, TypeError) as exc:
        raise RecoveryError(f"INVALID_{field.upper()}") from exc


def parse_archive(raw: bytes) -> tuple[dict, bytes]:
    if len(raw) < 9 or raw[:4] != MAGIC:
        raise RecoveryError("INVALID_MAGIC")
    if raw[4] != BUNDLE_VERSION:
        raise RecoveryError("UNSUPPORTED_BUNDLE_VERSION")
    header_length = struct.unpack(">I", raw[5:9])[0]
    if header_length == 0 or header_length > MAX_HEADER_BYTES or 9 + header_length >= len(raw):
        raise RecoveryError("INVALID_HEADER_LENGTH")
    try:
        header = json.loads(raw[9 : 9 + header_length].decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RecoveryError("INVALID_HEADER_JSON") from exc
    if not isinstance(header, dict):
        raise RecoveryError("INVALID_HEADER_JSON")
    if header.get("schema") != SCHEMA:
        raise RecoveryError("UNSUPPORTED_SCHEMA")
    if header.get("recoverySpecVersion") != SPEC_VERSION:
        raise RecoveryError("UNSUPPORTED_RECOVERY_SPEC_VERSION")
    return header, raw[9 + header_length :]


def decrypt_archive(raw: bytes, passphrase: str) -> tuple[bytes, dict]:
    header, ciphertext = parse_archive(raw)
    if hashlib.sha256(ciphertext).hexdigest() != header.get("contentHash"):
        raise RecoveryError("CONTENT_HASH_MISMATCH")

    wrap = header.get("recoveryWrap")
    if not isinstance(wrap, dict) or wrap.get("method") != "passphrase-v1":
        raise RecoveryError("PASSPHRASE_WRAP_UNAVAILABLE")
    iterations = wrap.get("iterations")
    if not isinstance(iterations, int) or iterations <= 0:
        raise RecoveryError("INVALID_KDF_ITERATIONS")

    # Interoperability assumptions not explicit in RECOVERY-SPEC.md:
    # UTF-8 passphrase bytes, no Unicode normalization, no AES-GCM AAD, and the
    # standard 16-byte GCM tag appended to each ciphertext by AESGCM.
    wrapping_key = hashlib.pbkdf2_hmac(
        "sha256",
        passphrase.encode("utf-8"),
        decode64(wrap.get("salt"), "recovery_salt"),
        iterations,
        dklen=32,
    )
    try:
        file_key = AESGCM(wrapping_key).decrypt(
            decode64(wrap.get("iv"), "recovery_iv"),
            decode64(wrap.get("encryptedAesKey"), "encrypted_aes_key"),
            None,
        )
    except Exception as exc:
        raise RecoveryError("WRONG_CREDENTIAL_OR_CORRUPT_KEY_WRAP") from exc
    if len(file_key) != 32:
        raise RecoveryError("INVALID_FILE_KEY_LENGTH")

    try:
        plaintext = AESGCM(file_key).decrypt(
            decode64(header.get("encryptedFileIv"), "encrypted_file_iv"),
            ciphertext,
            None,
        )
        metadata_raw = AESGCM(file_key).decrypt(
            decode64(header.get("encryptedMetadataIv"), "encrypted_metadata_iv"),
            decode64(header.get("encryptedMetadata"), "encrypted_metadata"),
            None,
        )
        metadata = json.loads(metadata_raw.decode("utf-8"))
    except RecoveryError:
        raise
    except Exception as exc:
        raise RecoveryError("AUTHENTICATED_DECRYPTION_FAILED") from exc
    if not isinstance(metadata, dict):
        raise RecoveryError("INVALID_DECRYPTED_METADATA")
    expected_size = metadata.get("originalFileSize")
    if isinstance(expected_size, int) and expected_size != len(plaintext):
        raise RecoveryError("PLAINTEXT_SIZE_MISMATCH")
    return plaintext, metadata


def safe_name(metadata: dict) -> str:
    value = metadata.get("originalFileName")
    if not isinstance(value, str) or not value.strip():
        return "recovered.bin"
    name = Path(value).name
    return name if name not in {".", "..", ""} else "recovered.bin"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--passphrase-file", required=True, type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        passphrase = args.passphrase_file.read_text(encoding="utf-8")
        if passphrase.endswith("\n"):
            passphrase = passphrase[:-1]
        plaintext, metadata = decrypt_archive(args.archive.read_bytes(), passphrase)
        args.output.mkdir(parents=True, exist_ok=True)
        output_path = args.output / safe_name(metadata)
        output_path.write_bytes(plaintext)
        result = {
            "outputPath": str(output_path.resolve()),
            "plaintextSha256": hashlib.sha256(plaintext).hexdigest(),
            "bytes": len(plaintext),
        }
        print(json.dumps(result) if args.json else output_path)
        return 0
    except (OSError, RecoveryError) as exc:
        code = str(exc) if isinstance(exc, RecoveryError) else "IO_ERROR"
        print(f"INDEPENDENT_RECOVERY_ERROR {code}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
