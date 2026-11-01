# Threat Model

**Method:** STRIDE-inspired review. This is a living design artifact; update it before any architecture, dependency, provider or privileged-flow change.

| Area / asset | Threats | Mitigations | Residual risk | Verification |
|---|---|---|---|---|
| Accounts and sessions | Credential stuffing, enumeration, reset-token theft, session fixation/reuse | Argon2id, breached-password check, generic responses, per-IP/account/global velocity controls, single-use hashed reset tokens, cookie flags, rotating refresh families/reuse revocation, email verification | Phishing and compromised endpoint remain possible | Auth lifecycle, enumeration, reset expiry, token-reuse, cookie and rate-limit tests |
| WebSocket and ticket | Stolen URL token, cross-origin socket, replay/flood, oversized/slow consumer | 60-second single-use REST-issued ticket bound to user/origin; no URL token; TLS/origin/schema/auth checks; message/connection caps, heartbeat, backpressure | Attacker with active browser/session may act as user until detected | Ticket expiry/single-use/origin, authorization, size, connection-cap, slow-consumer tests |
| Room codes and invites | Guessing, token leakage, unauthorized joins, replay | CSPRNG high-entropy code/token, hash at rest, expiry/single-use, member authorization, safe errors, rate limit analysis | User may share invite intentionally | Entropy/unit, hash-at-rest, expiry/replay/IDOR and guess-rate tests |
| Dice and seed | Rigged/replayed rolls, seed disclosure, compromise/abort bias | KMS envelope encryption, roll-service-only role, player entropy commit/reveal, fixed binary HMAC/rejection sampling, proof/event verifier, secret-read audit, abort-rate alerting | Server can abort; KMS/insider compromise; player collusion | Vector, seed-leak, role-grant, proof-replay, event-chain, abort-monitor tests |
| Game state and commands | Client state forgery, stale/race double move, event tamper, unauthorized seat action | Server authority, schema/seat/turn/version checks, per-game serialization, command log, append-only hash chain, derived snapshots, DB transactions/outbox | DB/application vulnerability can disrupt availability | Rule property, concurrency, duplicate/idempotency, event-replay, IDOR tests |
| Chat (v1.1+) | Harassment, XSS, data leak, flooding | Feature flag off in v1; output encoding, strict CSP, length/rate limits, mute/block/report/moderation, retention policy | Moderation false positives/negatives | XSS, rate-limit, authorization, retention and report workflow tests before enablement |
| Moderation/admin | Privilege escalation, malicious action, unmasked data access | MFA, separate origin/network/VPN or IP allowlist, least roles, append-only audit, masked support UI, owner review | Compromised privileged device or insider | Role/MFA/IDOR, audit-immutability, masked-data and access-review tests |
| CI/CD and supply chain | Dependency compromise, unsafe workflow, secret exfiltration, malicious fork PR | Lockfiles/pinning, OSV/npm/license/SBOM scans, SHA-pinned Actions, least GITHUB_TOKEN, no secrets to forks, no untrusted pull_request_target, provenance/image scans | Zero-day supply-chain risk | Workflow policy lint, dependency/secret/SBOM/image scans, provenance check |
| Secrets and KMS | Commit leak, runtime exfiltration, plaintext backup/log/coredump | Managed secret store/runtime injection, push protection, redaction test, KMS roles/rotation, encrypted backups, no plaintext seed persistence | Provider/KMS control-plane compromise | Secret scan, client-bundle scan, log-redaction, IAM/restore/key-rotation drills |
| Infrastructure/network | DDoS, SSRF, metadata theft, public DB/Redis, container escape | CDN/WAF/DDoS controls, private DB/Redis TLS, outbound allowlist/timeouts, metadata block, non-root read-only containers/cap drops/resource limits | Large DDoS/provider outage | External posture review, SSRF test, network/IAM scan, load/chaos tests |
| Insider and operations | Unauthorized seed read, hidden reroll, log tampering, unsafe hotfix | Separate roles, secret-read audit/alert, no reroll capability, immutable audit, branch protection/owner review, hotfix checks, two-person sensitive changes where supported | Privileged insider can affect availability | Audit alert, permission review, protected-branch and hotfix rehearsal |
| Privacy/data lifecycle | Excess PII, retention failure, support exposure, breach | Minimize collection, classification, encrypted transport/storage, retention/deletion jobs, masked support data, audited PII access | Legal/jurisdiction decisions pending | Data inventory, deletion/export, restore, access-log review |

## Trust boundaries

- Browser-to-edge, edge-to-API, API-to-DB/Redis/KMS/email service, CI-to-artifact registry/deployer, and support/admin-to-production are separate trust boundaries.
- Every boundary authenticates, authorizes, validates data shape/size and produces redacted security telemetry.
- Production identity, credentials and data never enter development/staging. No secret is accepted from a client or copied into documentation.

## High-value invariants

1. Only the roll/fairness service can obtain a live server seed.
2. No accepted dice/move command executes more than once.
3. Each game event sequence/hash chain is complete and independently replayable.
4. No browser can issue a valid command without authenticated membership, correct seat, phase and version.
5. No deployment path bypasses protected review, required CI or secret scanning.
6. A failure in Redis/fan-out cannot fabricate or lose an already committed game transition.
