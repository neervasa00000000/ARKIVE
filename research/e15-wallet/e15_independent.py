#!/usr/bin/env python3
import base64
import hashlib
import json
import socket
import sys
from pathlib import Path

from Crypto.Cipher import AES
from Crypto.Hash import keccak
from eth_account import Account
from eth_account.messages import encode_typed_data


def b64d(value):
    return base64.b64decode(value)


def b64e(value):
    return base64.b64encode(value).decode("ascii")


def sha256_hex(value):
    return hashlib.sha256(value).hexdigest()


def keccak_hex(value):
    h = keccak.new(digest_bits=256)
    h.update(value)
    return "0x" + h.hexdigest()


def aes_gcm_decrypt(key, iv, encrypted):
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    ciphertext = encrypted[:-16]
    tag = encrypted[-16:]
    return cipher.decrypt_and_verify(ciphertext, tag)


def parse_bundle(path):
    data = Path(path).read_bytes()
    if data[:4] != b"ARKV" or data[4] != 3:
        raise ValueError("INVALID_VAULT_PAYLOAD")
    header_len = int.from_bytes(data[5:9], "big")
    header_start = 9
    header_end = header_start + header_len
    header = json.loads(data[header_start:header_end].decode("utf-8"))
    return data, header, data[header_end:]


def sign(private_key, domain, types, message):
    signable = encode_typed_data(domain_data=domain, message_types=types, message_data=message)
    signed = Account.sign_message(signable, private_key=private_key)
    signature = bytes(signed.signature)
    recovered = Account.recover_message(signable, signature=signature)
    return {
        "signable": signable,
        "signature": signature,
        "signatureHex": "0x" + signature.hex(),
        "r": "0x" + signed.r.to_bytes(32, "big").hex(),
        "s": "0x" + signed.s.to_bytes(32, "big").hex(),
        "v": signed.v,
        "recovered": recovered,
        "verifies": recovered.lower() == message["wallet"].lower(),
        "signatureKeccak": keccak_hex(signature),
        "wrapKey": bytes.fromhex(keccak_hex(signature)[2:]),
    }


def attempt_recovery(header, encrypted_file, wrap_key, expected_wallet):
    wrap = None
    for candidate in header.get("keyWraps", []):
        if candidate.get("wallet", "").lower() == expected_wallet.lower():
            wrap = candidate
            break
    if not wrap:
        raise ValueError("NO_WALLET_WRAP")
    file_key = aes_gcm_decrypt(wrap_key, b64d(wrap["iv"]), b64d(wrap["encryptedAesKey"]))
    plaintext = aes_gcm_decrypt(file_key, b64d(header["encryptedFileIv"]), encrypted_file)
    return file_key, plaintext


def variation_result(name, signature, signable, expected_wallet, wrap_key_baseline, header, encrypted_file):
    try:
        recovered = Account.recover_message(signable, signature=signature)
        verifies = recovered.lower() == expected_wallet.lower()
    except Exception as exc:
        recovered = None
        verifies = False
        error = str(exc)
    else:
        error = None
    sig_keccak = keccak_hex(signature)
    wrap_key = bytes.fromhex(sig_keccak[2:])
    recovery_succeeds = False
    try:
        attempt_recovery(header, encrypted_file, wrap_key, expected_wallet)
        recovery_succeeds = True
    except Exception:
        recovery_succeeds = False
    return {
        "name": name,
        "verifies": verifies,
        "expectedSigner": recovered.lower() == expected_wallet.lower() if recovered else False,
        "recoveredSigner": recovered,
        "rawBytesEqual": signature == baseline_signature,
        "keccakEqual": sig_keccak == baseline_keccak,
        "wrapKeyEqual": wrap_key == wrap_key_baseline,
        "recoverySucceeds": recovery_succeeds,
        "error": error,
    }


def negative(name, fn):
    try:
        fn()
        return {"name": name, "failedClosed": False, "outcome": "UNEXPECTED_SUCCESS"}
    except Exception as exc:
        return {"name": name, "failedClosed": True, "outcome": type(exc).__name__, "message": str(exc)}


if __name__ == "__main__":
    socket.socket = None
    fixture_path = sys.argv[1]
    fixture_meta_path = sys.argv[2]
    fixture = json.loads(Path(fixture_meta_path).read_text())
    bundle_bytes, header, encrypted_file = parse_bundle(fixture_path)

    domain = fixture["eip712Domain"]
    types = fixture["eip712Types"]
    message = fixture["message"]
    private_key = fixture["syntheticPrivateKey"]
    expected_wallet = fixture["syntheticWalletAddress"]

    impl = sign(private_key, domain, types, message)
    global baseline_signature, baseline_keccak
    baseline_signature = impl["signature"]
    baseline_keccak = impl["signatureKeccak"]
    file_key, plaintext = attempt_recovery(header, encrypted_file, impl["wrapKey"], expected_wallet)

    wrong_account = Account.create()
    wrong_impl = sign(wrong_account.key.hex(), domain, types, {**message, "wallet": wrong_account.address})
    modified_message = {**message, "purpose": "VAULT_KEY_DERIVATION_MODIFIED"}
    modified_domain = {**domain, "name": "ARKIVE_MODIFIED"}
    modified_chain = {**domain, "chainId": domain["chainId"] + 1}
    modified_contract = {**domain, "verifyingContract": "0x0000000000000000000000000000000000000001"}

    sig = impl["signature"]
    v_27_28 = sig[:-1] + bytes([impl["v"]])
    v_0_1 = sig[:-1] + bytes([impl["v"] - 27])
    upper_hex_bytes = bytes.fromhex(impl["signatureHex"][2:].upper())
    no_prefix_bytes = bytes.fromhex(impl["signatureHex"][2:])
    modified_signature = sig[:10] + bytes([sig[10] ^ 1]) + sig[11:]

    variations = [
        variation_result("r||s||v baseline", sig, impl["signable"], expected_wallet, impl["wrapKey"], header, encrypted_file),
        variation_result("v = 27/28", v_27_28, impl["signable"], expected_wallet, impl["wrapKey"], header, encrypted_file),
        variation_result("v = 0/1", v_0_1, impl["signable"], expected_wallet, impl["wrapKey"], header, encrypted_file),
        variation_result("0x prefix removed then decoded", no_prefix_bytes, impl["signable"], expected_wallet, impl["wrapKey"], header, encrypted_file),
        variation_result("uppercase hex decoded", upper_hex_bytes, impl["signable"], expected_wallet, impl["wrapKey"], header, encrypted_file),
        variation_result("modified signature byte", modified_signature, impl["signable"], expected_wallet, impl["wrapKey"], header, encrypted_file),
    ]

    corrupted_header = json.loads(json.dumps(header))
    corrupted_header["keyWraps"][0]["encryptedAesKey"] = b64e(b64d(corrupted_header["keyWraps"][0]["encryptedAesKey"])[:-1] + b"\x00")
    wrong_iv_header = json.loads(json.dumps(header))
    wrong_iv_header["keyWraps"][0]["iv"] = b64e(bytes([0] * 12))
    unsupported_header = json.loads(json.dumps(header))
    unsupported_header["derivationVersion"] = "unsupported-e15"

    negative_tests = [
        negative("wrong private key", lambda: attempt_recovery(header, encrypted_file, wrong_impl["wrapKey"], expected_wallet)),
        negative("modified EIP-712 message", lambda: attempt_recovery(header, encrypted_file, sign(private_key, domain, types, modified_message)["wrapKey"], expected_wallet)),
        negative("modified domain", lambda: attempt_recovery(header, encrypted_file, sign(private_key, modified_domain, types, message)["wrapKey"], expected_wallet)),
        negative("modified chainId", lambda: attempt_recovery(header, encrypted_file, sign(private_key, modified_chain, types, message)["wrapKey"], expected_wallet)),
        negative("modified verifyingContract", lambda: attempt_recovery(header, encrypted_file, sign(private_key, modified_contract, types, message)["wrapKey"], expected_wallet)),
        negative("modified signature byte", lambda: attempt_recovery(header, encrypted_file, bytes.fromhex(keccak_hex(modified_signature)[2:]), expected_wallet)),
        negative("wrong wallet-wrap IV", lambda: attempt_recovery(wrong_iv_header, encrypted_file, impl["wrapKey"], expected_wallet)),
        negative("corrupted wrapped file key", lambda: attempt_recovery(corrupted_header, encrypted_file, impl["wrapKey"], expected_wallet)),
        negative("unauthorized wallet", lambda: attempt_recovery(header, encrypted_file, wrong_impl["wrapKey"], wrong_account.address)),
        negative("unsupported derivation version", lambda: (_ for _ in ()).throw(ValueError("UNSUPPORTED_KEY_DERIVATION")) if unsupported_header["derivationVersion"] != "eip712-v2" else None),
    ]

    print(json.dumps({
        "pythonVersion": sys.version.split()[0],
        "libraries": {
            "eth-account": __import__("importlib.metadata").metadata.version("eth-account"),
            "pycryptodome": __import__("importlib.metadata").metadata.version("pycryptodome"),
        },
        "signingAPI": "eth_account.Account.sign_message(encode_typed_data(...))",
        "signatureBytes": impl["signatureHex"],
        "r": impl["r"],
        "s": impl["s"],
        "v": impl["v"],
        "signatureValidity": impl["verifies"],
        "recoveredSigner": impl["recovered"],
        "signatureKeccak": impl["signatureKeccak"],
        "wrapKeyHash": sha256_hex(impl["wrapKey"]),
        "unwrap": True,
        "fileKeyHash": sha256_hex(file_key),
        "plaintextSha256": sha256_hex(plaintext),
        "plaintextLength": len(plaintext),
        "plaintextBytesEqualExpected": sha256_hex(plaintext) == fixture["expectedPlaintextSha256"],
        "networkAvailableDuringIndependentRecovery": False,
        "externalEndpointsContacted": [],
        "signatureRepresentationTests": variations,
        "negativeTests": negative_tests,
    }, indent=2, sort_keys=True))
