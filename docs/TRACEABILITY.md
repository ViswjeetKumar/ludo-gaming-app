# Requirements Traceability

This matrix records the hardened specification coverage. `non-DB` means the control is enforced in application, infrastructure, CI/CD or operational configuration rather than modeled as a durable entity.

| Requirement area | Primary source | ERD mapping | Status/gap |
|---|---|---|---|
| Account identity, verification, password reset, sessions | DEVELOPMENT_SPEC §4 | USERS, AUTH_IDENTITIES, EMAIL_VERIFICATION_TOKENS, PASSWORD_RESET_TOKENS, REFRESH_SESSIONS | Modeled; provider/config implementation deferred to Phase 3 |
| Roles and privileged actions | DEVELOPMENT_SPEC §3, LIVE_SECURITY §6 | USER_ROLES, AUDIT_LOG, MODERATION_ACTIONS | Modeled; admin network/MFA is non-DB |
| Private rooms/membership/invites/rematches | DEVELOPMENT_SPEC §4 | GAME_ROOMS, ROOM_MEMBERS, GAME_INVITES, GAMES | Modeled; code entropy/rate limiting is non-DB |
| Frozen rules and seats | RULES, DEVELOPMENT_SPEC §4 | GAMES.rules_version/rules_snapshot, GAME_SEATS | Modeled; selected preset remains [CONFIRM] |
| Authoritative actions, ordering, retry safety | DEVELOPMENT_SPEC §§4–5 | GAME_TURNS, COMMAND_LOG, GAME_EVENTS, OUTBOX_EVENTS, GAMES.version | Modeled |
| Dice protocol and proof | FAIRNESS_VECTORS, DEVELOPMENT_SPEC §4 | GAME_SECRETS, FAIRNESS_PROOFS, DICE_ROLLS, GAME_EVENTS, AUDIT_LOG | Modeled; Phase 4 must implement fallback-path test |
| Reconnect/deadlines/forfeit | RULES, DEVELOPMENT_SPEC §4 | GAMES.turn_deadline_at, GAME_SEATS.timeout_streak/status, GAME_EVENTS | Modeled; WebSocket mechanics are non-DB |
| Reports/moderation | DEVELOPMENT_SPEC §4, THREAT_MODEL | REPORTS, MODERATION_ACTIONS, USER_ROLES, AUDIT_LOG | Modeled |
| Social/friends/chat/matchmaking | DEVELOPMENT_SPEC §2 | FRIENDSHIPS remains reserved; chat/matchmaking tables absent by design | v1.1+ feature-flagged; no v1 gap |
| Input validation, headers, TLS, WebSocket ticket/rate limits | LIVE_SECURITY §5 | non-DB; command records/events support audit | Phase 2/3 implementation required |
| Secrets/KMS/least privilege/rotation | LIVE_SECURITY §§1,4,8 | GAME_SECRETS, AUDIT_LOG; KMS/IAM is non-DB | Modeled and operational controls specified |
| CI/CD, branch protection, supply chain | LIVE_SECURITY §2 | non-DB; CODEOWNERS/PR template files | Hosting settings still unverified |
| Release safety/flags/kill switches | LIVE_SECURITY §3 | non-DB; GAMES/OUTBOX support safe recovery | Phase 2+ required |
| Monitoring/verifier/redaction | LIVE_SECURITY §8 | GAME_EVENTS, FAIRNESS_PROOFS, AUDIT_LOG | Non-DB jobs/alerts required |
| Privacy/retention/backups | DEVELOPMENT_SPEC §7, LIVE_SECURITY §9 | deleted/used/revoked/expiry fields and classifications in ERD | Jurisdiction/retention durations remain [CONFIRM] |
| Incident response and launch gates | RUNBOOKS, LIVE_SECURITY §11 | AUDIT_LOG and integrity records support evidence; otherwise non-DB | Must be evidenced in Phase 9 |

Every ERD table appears in [ERD.md](ERD.md)'s diagram, constraints/integrity sections and data-classification table. There is no unmodeled v1 functional requirement that requires a new database entity. Remaining gaps are deliberately marked as Phase work or **[CONFIRM]**, not assumed complete.
