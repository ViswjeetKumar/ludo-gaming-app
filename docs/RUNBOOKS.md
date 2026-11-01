# Security and Operations Runbooks

Runbooks are operational requirements, not evidence of a completed drill. Every incident records incident ID, owner, timestamps, scope, decisions, evidence, customer impact and post-mortem actions. Never paste secrets, raw tokens, seeds, passwords, private emails or raw IPs into tickets/chat.

## Severity and patch SLA

| Severity | Example | Acknowledge | Mitigate | Permanent fix |
|---|---|---:|---:|---:|
| SEV-1 | Confirmed seed/key leak, active data breach, broad account takeover, game integrity failure | 15 min | 1 hour | critical patch or safe shutdown within 24–48 h |
| SEV-2 | Credible rigging suspicion, major DDoS, critical dependency exposure without observed breach | 30 min | 4 h | fix within 7 days; faster if exploit is active |
| SEV-3 | Limited-impact auth/availability defect, isolated moderation compromise | 4 h | 1 business day | fix within 30 days |
| SEV-4 | Low-impact hardening/observability gap | 2 business days | planned | fix within 90 days |

## Shared incident flow

1. **Detect:** acknowledge alert/report; preserve redacted logs, event proofs and immutable audit IDs.
2. **Contain:** activate the narrowest safe kill switch, revoke compromised identities/tokens, isolate affected environment and stop harmful automation.
3. **Eradicate:** identify root cause, remove malicious artifacts/permissions, rotate relevant secrets/keys and patch vulnerable code/dependency.
4. **Recover:** restore clean service/data, validate integrity/fairness, run smoke tests and monitor after restoration.
5. **Communicate:** incident lead updates internal stakeholders; user/regulator communications follow legal/privacy plan and use facts only.
6. **Learn:** blameless post-mortem with timeline, impact, root cause, control gap, owner/date for corrective actions, and a rehearsal if needed.

## Seed or KMS key leak

- Immediately pause new games and set affected active games to safe void-pending; do not continue a potentially compromised fairness process.
- Restrict/disable roll-service identity, snapshot KMS/IAM/audit evidence, identify affected game/seed/key scope and preserve event chains.
- Rotate KMS/application credentials, invalidate data keys where supported, revoke related access and inspect `GAME_SECRETS` read audit trail.
- Void active affected games with explicit reason; disclose proofs only through approved incident process. Do not expose still-sensitive material in public logs.
- Rebuild/verify unaffected games, announce verified impact and remediation, then require a key-leak game-day follow-up.

## Suspected rigging or fairness mismatch

- Pause new games for the affected algorithm/version; preserve game events, proof row and verifier output.
- Run independent verifier against every game in scope; compare event hashes, rules snapshot, commitments, nonce reveals and dice vector implementation.
- If mismatch: void affected active matches, disable release/feature flag, escalate SEV-1 and preserve forensic copies.
- If no mismatch: document result, monitor anomaly signals and communicate outcome without disclosing player private data.

## DDoS or WebSocket flood

- Enable WAF/CDN emergency profile, tighten connection/message limits, pause matchmaking/new rooms if necessary and protect authenticated play priority.
- Scale within predefined cap; reject excess connections with safe retry guidance. Do not weaken authorization, TLS or logging controls.
- Trace sources only through approved privacy process; validate queue/backpressure behavior and service recovery.
- After recovery, review thresholds and run reconnect-storm rehearsal.

## Credential stuffing or account takeover wave

- Raise login/reset challenge/velocity controls, require reauthentication for suspicious sessions and revoke confirmed compromised token families.
- Preserve redacted auth telemetry; notify affected users through verified channels after scope review.
- Review breached-password checks, MFA coverage, email security and enumeration behavior. Do not lock accounts solely from one IP signal.
- Monitor for fraudulent room/game behavior; verify privileged sessions separately.

## Leaked secret in repository or CI

- Treat committed secret as exposed even if repository is private or deleted later. Revoke/rotate first, then remove reference through approved Git history/hosting process.
- Disable affected pipeline/integration; inspect CI logs, artifacts, caches, fork exposure and deployment history.
- Open a security incident, add detection rule, verify new credential works, and scan all branches/history/artifacts.
- Record why push protection/scan missed it and prevent recurrence.

## Critical dependency vulnerability

- Identify version, exploitability, reachable components and affected environments; add temporary WAF/config mitigation where available.
- Disable the affected feature if needed, update or patch, rebuild pinned artifact, run required regression/security tests and deploy through hotfix path.
- If no patch exists, retain compensating controls and escalation timeline; meet severity SLA.

## Database corruption or restore

- Stop writes or enter read-only/maintenance mode; preserve forensic copy and identify last known-good restore point.
- Restore to isolated environment first, validate schema/event chain/fairness proofs and reconcile outbox delivery.
- Restore production only after data owner approval and smoke tests; communicate potential data loss precisely.
- Run root-cause review, backup integrity review and restore drill follow-up.

## Data breach

- Contain access path, preserve evidence, rotate credentials, determine data categories/subjects/time window and engage privacy/legal owner.
- Do not speculate externally. Meet applicable notification timelines after confirmed scope and counsel review.
- Reset affected sessions/credentials, provide remediation steps, and track correction actions to closure.

## Moderator or administrator account compromise

- Immediately revoke account sessions/roles, remove allowlist/VPN access and rotate any credential the account could access.
- Review append-only audit trail, role changes, PII reads, moderation actions and deployment/secret access since last known-good activity.
- Reestablish access with new MFA factor and two-person review; notify affected players only if impact is verified.
- Add detections and complete a privileged-access drill.
