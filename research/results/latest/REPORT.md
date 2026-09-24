# ARKIVE Recovery Dependency Experiments

Commit: `aaa7b413fdc4fb373c03b835d4620f461e6d5a59`
Summary generated: 2026-09-23T16:02:03.511Z

| Experiment | Dependency removed | Expected | Actual | Exact bytes | Result |
| --- | --- | --- | --- | --- | --- |
| E01 | None | RECOVERY_SUCCESS | RECOVERY_SUCCESS | Yes | PASS |
| E02 | arkive_frontend | RECOVERY_SUCCESS | RECOVERY_SUCCESS | Yes | PASS |
| E03 | arkive_backend, network | RECOVERY_SUCCESS | RECOVERY_SUCCESS | Yes | PASS |
| E04 | base_rpc, vault_registry, network | RECOVERY_SUCCESS | RECOVERY_SUCCESS | Yes | PASS |
| E05 | primary_arweave_gateway | RECOVERY_SUCCESS | ENVIRONMENT_UNAVAILABLE | N/A | SKIPPED |
| E06 | wallet_application, network | RECOVERY_SUCCESS | RECOVERY_SUCCESS | Yes | PASS |
| E07 | local_storage, indexed_db, browser_cache, browser_session, network | RECOVERY_SUCCESS | RECOVERY_SUCCESS | Yes | PASS |
| E08 | correct_credential | RECOVERY_REJECTED | RECOVERY_REJECTED | N/A | PASS |
| E09 | None | RECOVERY_REJECTED | RECOVERY_REJECTED | N/A | PASS |
| E10 | None | RECOVERY_REJECTED | RECOVERY_REJECTED | N/A | PASS |
| E11 | primary_storage_provider, network | RECOVERY_SUCCESS_FROM_REPLICA | RECOVERY_SUCCESS | Yes | PASS |
| E12 | None | RECOVERY_REJECTED | RECOVERY_REJECTED | N/A | PASS |
| E13 | undocumented_wire_format_assumptions | SPECIFICATION_CONFORMANCE | RECOVERY_SUCCESS | Yes | NOT VALIDATED |

E05 is produced by the gateway-independence harness. E11 is E11-A from the storage-replica harness.
E13 records specification conformance separately from fresh specification-only reimplementation.
Independent implementation evidence is in `INDEPENDENT-RECOVERY.json`.
