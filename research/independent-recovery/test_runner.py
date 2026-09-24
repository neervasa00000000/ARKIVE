#!/usr/bin/env python3
"""Compare independent implementation B with existing CLI A as black boxes."""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "research/fixtures/archives/passphrase-v1.arkive"
PLAINTEXT = ROOT / "research/fixtures/plaintext/recovery-test.bin"
HASHES = json.loads((ROOT / "research/fixtures/expected/hashes.json").read_text())
METADATA = json.loads((ROOT / "research/fixtures/metadata.json").read_text())
RESULT = ROOT / "research/results/latest/INDEPENDENT-RECOVERY.json"
PYTHON_IMPL = Path(__file__).with_name("recover.py")
NODE_IMPL = ROOT / "tools/arkive-recover/cli.mjs"
AMBIGUITIES = [
    "Passphrase character encoding and Unicode normalization are not explicit.",
    "AES-GCM authentication tag length and ciphertext/tag serialization are not explicit.",
    "AES-GCM additional authenticated data presence and encoding are not explicit.",
    "Decrypted metadata JSON character encoding is not explicit.",
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(command: list[str], env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=ROOT, env=env, text=True, capture_output=True, check=False)


def recovered_file(directory: Path) -> Path:
    files = [path for path in directory.iterdir() if path.is_file()]
    if len(files) != 1:
        raise RuntimeError(f"expected one recovered file in {directory}, found {len(files)}")
    return files[0]


def invoke_b(archive: Path, output: Path, credential: Path) -> subprocess.CompletedProcess[str]:
    return run(["python3", str(PYTHON_IMPL), str(archive), "--output", str(output), "--passphrase-file", str(credential), "--json"])


def invoke_a(archive: Path, output: Path, credential: str) -> subprocess.CompletedProcess[str]:
    env = {"PATH": str(Path(shutil.which("node") or "").parent), "ARKIVE_RECOVERY_PASSPHRASE": credential}
    return run(["node", str(NODE_IMPL), "recover", str(archive), "--output", str(output), "--json"], env=env)


with tempfile.TemporaryDirectory(prefix="arkive-independent-") as temporary:
    work = Path(temporary)
    credential = METADATA["testOnlyPassphrase"]
    credential_file = work / "credential.txt"
    credential_file.write_text(credential, encoding="utf-8")
    output_a, output_b = work / "a", work / "b"
    output_a.mkdir(); output_b.mkdir()
    success_a = invoke_a(FIXTURE, output_a, credential)
    success_b = invoke_b(FIXTURE, output_b, credential_file)
    if success_a.returncode or success_b.returncode:
        raise SystemExit(f"baseline comparison failed\nA: {success_a.stderr}\nB: {success_b.stderr}")
    file_a, file_b = recovered_file(output_a), recovered_file(output_b)

    wrong = work / "wrong.txt"
    wrong.write_text("deliberately wrong synthetic credential", encoding="utf-8")
    corrupt = work / "corrupt.arkive"
    corrupt_bytes = bytearray(FIXTURE.read_bytes()); corrupt_bytes[-1] ^= 1
    corrupt.write_bytes(corrupt_bytes)
    unsupported = work / "unsupported.arkive"
    unsupported_bytes = bytearray(FIXTURE.read_bytes()); unsupported_bytes[4] = 4
    unsupported.write_bytes(unsupported_bytes)

    negative = {}
    for name, archive, pass_file, pass_value in [
        ("wrongCredential", FIXTURE, wrong, wrong.read_text()),
        ("ciphertextCorruption", corrupt, credential_file, credential),
        ("unsupportedVersion", unsupported, credential_file, credential),
    ]:
        out_a, out_b = work / f"{name}-a", work / f"{name}-b"
        out_a.mkdir(); out_b.mkdir()
        a = invoke_a(archive, out_a, pass_value)
        b = invoke_b(archive, out_b, pass_file)
        negative[name] = {
            "implementationA": "REJECTED" if a.returncode else "ACCEPTED",
            "implementationB": "REJECTED" if b.returncode else "ACCEPTED",
            "bothFailClosed": bool(a.returncode and b.returncode),
        }

    sha_a, sha_b = sha256(file_a), sha256(file_b)
    exact = file_a.read_bytes() == file_b.read_bytes() == PLAINTEXT.read_bytes()
    functional_success = sha_a == sha_b == HASHES["plaintextSha256"] and exact and all(
        item["bothFailClosed"] for item in negative.values()
    )
    result = {
        "experimentId": "INDEPENDENT-RECOVERY",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "gitCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "implementationLanguage": "Python 3",
        "librariesUsed": ["Python standard library", "cryptography 47.0.0"],
        "specificationFilesConsulted": ["docs/RECOVERY-SPEC.md"],
        "implementationAuthoredAgainst": "Recovery Specification v1 before the 2026-09-24 interoperability clarification",
        "arkiveProductionOrRecoverySourceConsulted": False,
        "fixture": str(FIXTURE.relative_to(ROOT)),
        "expectedSha256": HASHES["plaintextSha256"],
        "implementationASha256": sha_a,
        "implementationBSha256": sha_b,
        "exactByteEquality": exact,
        "wrongCredentialResult": negative["wrongCredential"],
        "corruptionResult": negative["ciphertextCorruption"],
        "unsupportedVersionResult": negative["unsupportedVersion"],
        "specificationAmbiguities": AMBIGUITIES,
        "functionalInteroperability": "PASS" if functional_success else "FAIL",
        "specificationSufficiencyFinding": "HISTORICAL SPECIFICATION INSUFFICIENT",
        "currentClarifiedSpecificationAssessment": "OUT OF SCOPE — see E13",
        "result": "NOT VALIDATED" if functional_success else "FAIL",
    }
    RESULT.parent.mkdir(parents=True, exist_ok=True)
    RESULT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    if not functional_success:
        raise SystemExit(1)
