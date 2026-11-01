# Live Security Requirements

These controls are mandatory for a real-user launch. They are design requirements today and launch evidence requirements later; no item below is currently claimed implemented.

## 1. Environments and secrets

- Separate cloud accounts/projects, credentials, databases, KMS keys and data for development, staging and production. Non-production must never receive production data.
- Use managed secret storage and runtime identity injection. No production secret, seed, token, private key or service credential belongs in source control, CI logs, Docker build context, image layer, client bundle or documentation.
- Rotate application secrets at least every 90 days; rotate immediately after personnel/provider compromise, secret exposure or suspected misuse. Keep a tested rotation runbook and audit evidence.
- Enable repository secret scanning and push protection; CI scans source/history/image artifacts and verifies no configured secret variable is emitted in the client bundle.
- **Required tests:** secret scanner on every push/PR; build artifact grep for configured secret identifiers/values; quarterly rotation exercise; staging rollback after rotation.

## 2. Supply chain and CI/CD

- Commit lockfiles and pin direct dependency versions. CI blocks high/critical vulnerability findings from npm audit/OSV, requires license review, emits SBOM and scans source/container image.
- Pin GitHub Actions to full immutable commit SHAs. Give `GITHUB_TOKEN` minimum permissions. Never expose secrets to forked pull requests; do not use `pull_request_target` for untrusted code.
- Protect `main`: PR required, review required, required checks required, no force push, stale review dismissal and CODEOWNERS review on security paths. Only CI deployment identity can deploy production.
- Build minimal non-root containers; use read-only filesystem, dropped capabilities, resource limits, image scanning and provenance/attestation.
- **Required tests:** workflow policy scan, lockfile integrity, dependency/OSV/license/SBOM/image scans, no-secrets-to-fork test, provenance verification and protected-branch settings review.

## 3. Release safety

- Use expand/contract backwards-compatible DB migrations. Test each migration and rollback behavior against a production-size representative copy before production.
- Use canary or blue/green release with automated rollback on agreed error/latency thresholds. Feature flags wrap risky capabilities and default chat/matchmaking off until reviewed.
- Hotfix fast-lane still runs secret, dependency, fairness, auth/IDOR/WebSocket authorization, header/cookie and log-redaction gates; none may be bypassed.
- Provide tested kill switches: pause new games, disable registration, disable chat, disable matchmaking, read-only history, maintenance mode. Document owner and recovery test.
- Run post-deploy smoke tests for TLS/headers/cookie flags/CORS, no debug/test endpoint, no stack trace, auth and a non-mutating game-flow assertion.
- Begin with invite-only beta and explicit capacity caps; increase only after monitored soak.
- **Required tests:** migration compatibility, rollback, flag/kill-switch exercise, staged smoke suite and release-threshold alert simulation.

## 4. Network and runtime hardening

- TLS 1.2+ and HSTS; CDN/WAF/DDoS protection before public beta.
- PostgreSQL and Redis have no public IP, use private networking and TLS, and have separate least-privilege roles: API, roll/fairness, migrator, analytics and support.
- Harden containers: non-root UID, read-only root filesystem, dropped Linux capabilities, resource limits, no shell/debug endpoint in production.
- Apply timeouts, budgets and bounded retries to every DB, Redis, KMS, email and HTTP call. Block SSRF and cloud metadata access; use outbound allowlists where practical.
- Define graceful degradation: refuse/queue a new action safely rather than fabricate state. Redis/fan-out failure cannot lose committed events.
- **Required tests:** external exposure/IAM review, TLS/headers scan, SSRF/metadata test, container hardening inspection, dependency timeouts and DB/Redis outage exercise.

## 5. Application-layer controls

- Schema validation and size/range limits on every REST and WebSocket message.
- Every game command authorizes account, room membership, seat, phase, turn, expected version and idempotency key; serialize per game and write event/outbox/command log atomically.
- Run IDOR tests for every resource; use consistent not-found/forbidden response shape where needed to resist enumeration.
- Rate limit login, registration, password reset, room-code guessing, WebSocket messages and future chat by account, IP and global velocity without creating lockout DoS. Cap concurrent connections per user and messages/bytes per connection; disconnect slow consumers.
- WebSocket ticket is short-lived/single-use/bound to user+origin and never in URL. Validate origin.
- Send CSP with no inline scripts, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, strict referrer policy and safe cookie flags. Encode every user-controlled output.
- Document room-code/invite entropy and show rate-limit analysis before launch.
- **Required tests:** REST/WS schema fuzzing, authz/turn/version/IDOR matrix, duplicate command/race test, limit and backpressure test, origin/ticket test, CSP/header/cookie/XSS tests.

## 6. Authentication and privileged access

- Use Argon2id with parameters recorded in implementation ADR; support rehash-on-login upgrades. Reject breached passwords. Return generic authentication/reset/registration responses.
- Defend credential stuffing with per-account, per-IP and global velocity limits plus anomaly challenge; alert without revealing account existence.
- MFA is mandatory for moderator/admin. Player MFA is optional after v1 **[CONFIRM]**.
- Refresh-token rotation must detect reuse and revoke the whole token family. Provide session list/revoke-all.
- Sending domain must enforce SPF, DKIM and DMARC before email launch.
- Admin tools use separate origin/network behind VPN or IP allowlist and MFA; audit every role/action/data access.
- **Required tests:** password/hash policy, enumeration, reset/verification expiry, token family replay, MFA/role path, privileged-origin restriction and email authentication configuration review.

## 7. Anti-cheat and abuse

- Server is the only game authority. Client-visible state must not predict unrevealed roll outcomes.
- Detect and review multi-account/collusion indicators: shared device/IP within room, win-transfer patterns, improbable win-rate shifts and inhuman timing. These signals are review aids, not automatic guilt.
- Rate-limit rolls/commands; maintain immutable proof/event data; return only sanitized snapshots.
- v1 chat is disabled. Before chat is enabled, ship safe rendering, reports, mute/block, moderation controls, rate limits and retention review.
- **Required tests:** no-seed-in-response/log/cache scan, proof replay, scripted-client rate test, snapshot field allowlist test, report/moderation authorization tests.

## 8. Detection and integrity monitoring

- Structured logging uses enforced redaction of passwords, tokens, server/final seeds, emails and raw IPs (hash or truncate IP where legitimate security retention needs exist). Prove redaction with automated tests.
- Emit security events for authentication failures, refresh reuse, `GAME_SECRETS` reads, admin actions, role changes and rate-limit trips. Alert on abnormal rates and maintain an on-call destination.
- Continuous verifier replays every finished game: seed commitment, nonce commitments/reveals, final seed, roll derivation, event hash chain and rules version. Page on any mismatch.
- Run daily roll-distribution sanity checks; alerts are diagnostic and do not replace proof verification. Alert on database role/permission changes.
- **Required tests:** redaction fixture, secret-read audit event, verifier mismatch alert, permission-change alert, roll-monitor job and alert routing drill.

## 9. Data protection

- Encrypt data at rest and in transit; encrypt backups with separate keys. Restore-test backups on schedule and audit outcome.
- Minimize PII; define retention/deletion jobs and data export. Pseudonymize rather than delete match-integrity records where retention is justified.
- Audit PII access; support/admin tooling displays masked data by default.
- **Required tests:** backup restore, encryption/IAM review, retention/deletion/export test and masked-support view test.

## 10. Security regression protection

Required CI checks that cannot be skipped: fairness-vector tests; auth/IDOR/WebSocket authorization tests; CSP/header/cookie tests; log-redaction test; dependency, license, SBOM, image and secret scans. CODEOWNERS-path changes require owner review. Track coverage and each executed security check in `progress.md`.

## 11. Launch gates

No public launch until evidence shows: threat model review; independent security review or penetration test with critical/high findings fixed; load/reconnect-storm/chaos checks passed; backup restore drill done; runbooks rehearsed in a game day; SECURITY.md live; privacy notice, terms, age and jurisdiction decisions completed. Invite-only beta and capacity caps precede broad access.
