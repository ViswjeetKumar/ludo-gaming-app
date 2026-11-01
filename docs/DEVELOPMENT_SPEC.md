# Multiplayer Ludo — Product and Development Specification

**Status:** hardened planning baseline; application implementation has not started  
**Owner repository:** https://github.com/ViswjeetKumar/ludo-gaming-app  
**Last updated:** 2026-11-01

## 1. Product goal and fair-play boundary

Build a responsive, real-time web application for 2–4 authenticated players. The backend is authoritative for room membership, seat assignment, timers, legal actions, dice outcomes, event ordering and results. Clients render sanitized state and submit requests; they never decide an outcome.

Fair play means a documented and independently reproducible dice protocol, immutable game-event history, server-side rule enforcement and operational monitoring. It does not eliminate all residual risks: a malicious server operator could abort a game before revealing its seed, an insider could collude, or a compromised production environment could affect availability. The product must detect, limit, record and communicate these incidents; it must never claim an absolute guarantee.

No cash wagering, entry fees, prizes, real-money wallet, bots or guest seats are in v1 **[CONFIRM]**.

## 2. Scope and release plan

### v1 MVP
- Accounts: email verification, password login/reset, sessions/revocation and player profile.
- Private invite-code rooms for 2–4 players, ready/start flow and one or more rematches in the same room.
- Server-authoritative rules engine with the frozen classic-rules preset in [RULES.md](RULES.md).
- Commit-reveal player entropy, provably reproducible dice, proof reveal and game history.
- Plain WebSocket realtime play, reconnect/resync, timers, forfeit handling and accessible mobile-first web UI.
- Reports and minimum moderation/admin controls required to operate safely.

### v1.1+ behind feature flags
Public matchmaking, friends/social graph, text chat, OAuth, guest play, bots, cosmetics, rankings and tournaments. They are excluded from v1 runtime, API surface and launch gate unless explicitly enabled after a design/security review.

This resolves the earlier scope ambiguity: v1 is private rooms first; matchmaking and friends do not ship in v1.

## 3. Roles and access

- **Visitor:** reads public information and may create an account. No game or room access.
- **Player:** owns sessions/profile, creates or joins permitted rooms, plays a seat and files reports.
- **Moderator:** reviews reports and applies scoped moderation actions. MFA, separate admin origin/network, least privilege and audit logging are mandatory.
- **Administrator/on-call:** configures operation and handles incidents. MFA, allowlisted access path and immutable audit log are mandatory.
- The database has separate API, roll/fairness, migrator, read-only analytics and support roles. Only the roll/fairness role can read `GAME_SECRETS`.

## 4. Functional requirements

### Accounts and profile
- Unique username and verified email; generic success/error responses prevent account enumeration.
- Argon2id password hashing, breached-password screening, reset tokens/verification tokens hashed at rest and single-use.
- Short-lived access credentials and rotating refresh-token families in Secure, HttpOnly, SameSite cookies; reuse detection revokes the family.
- Session list and revoke-all; password change/suspension revokes active refresh families.
- Player display name, avatar reference and privacy preferences. Data export/deletion follows retention constraints in section 9.
- Moderator/admin MFA is required; player passkey/TOTP support is deferred **[CONFIRM]**.

### Private rooms and matches
- A signed-in player creates a 2–4 seat private room. The server stores only a hash of the high-entropy join code/invite token, rate-limits guesses, scopes tokens to a room, expires them and records use.
- Members join, leave and mark ready. Host starts only when valid seats meet the rules preset. Start freezes membership, seat/color order and a `rules_snapshot`; room rules become immutable for that game.
- A room can host rematches; every match has a new game ID, event chain, secret seed and proof.
- v1 has no public room listing, friends, matchmaking, chat, bots or guests.

### Game authority, reconnect and termination
- The backend serializes every command per game using transaction row locking or an equivalent single-flight game queue backed by the DB transaction. It validates schema, authenticated user, room membership, seat, active turn, expected game version and idempotency key before any state transition.
- `GAME_EVENTS` is the event-sourced truth; snapshots are derived caches. Accepted state changes, outbox rows and idempotency result records commit atomically before broadcasting.
- Reconnect obtains an authenticated sanitized snapshot plus events after the last verified sequence. Duplicate/replayed roll or move commands return the original accepted response from `COMMAND_LOG`.
- Deadlines are stored in `GAMES.turn_deadline_at` and recovered after process/deployment restart. Timer behavior and forfeit rules are in [RULES.md](RULES.md).
- A match ends once according to frozen rules. The server writes final placements/reason, emits terminal events, releases fairness evidence and makes a participant-scoped history available.
- Report flow: player may report a participant/game, creates a `REPORTS` row; moderator resolution and actions are audited.

### Fairness protocol
1. Roll/fairness service generates a 256-bit `server_seed` using the OS cryptographic RNG.
2. It envelope-encrypts that seed in `GAME_SECRETS`, using a per-game data key wrapped by a KMS master key. The secret never appears in game state, events, caches, Redis, logs, metrics, crash dumps, analytics, plaintext backups or client response.
3. The server publishes `SHA-256(server_seed)` as `server_seed_commitment`.
4. Each seated player submits a commitment to a cryptographically random client nonce; after all commitments, each reveals the nonce.
5. Service validates every reveal against its commitment, derives `final_seed = HMAC-SHA-256(server_seed, canonical(game_id, ordered_player_nonces))`, and only then starts the game.
6. A missing/invalid reveal before the first roll cancels start and returns the room to lobby with no penalty.
7. Dice rolls use the exact binary encoding and rejection sampling in [FAIRNESS_VECTORS.md](FAIRNESS_VECTORS.md). No administrator reroll exists.
8. At finish/void, service discloses the server seed and nonce proofs in `FAIRNESS_PROOFS`, destroys the active secret material, and independent verifier logic replays commitment, roll sequence, event hashes and frozen rules.
9. Monitor aborts between commitment/reveal/start by actor/system and alert on anomalous rates. Residual risks are server-abort bias and insider collusion; events, availability records and independent verification make them observable but do not make them impossible.

### Realtime transport and scaling
- v1 uses **plain WebSocket** only; it does not use Socket.IO **[CONFIRM]**.
- Browser first calls an authenticated REST endpoint to obtain a single-use WebSocket ticket with 60-second TTL, bound to authenticated user, requested origin and session. Ticket is sent in the initial WebSocket message, never in URL/query parameters, then consumed and revoked.
- Enforce TLS, origin allowlist, schema validation, authorization on every message, per-account/IP limits designed to avoid lockout enumeration, per-user connection cap, message-size cap, heartbeat, slow-consumer backpressure/disconnect and reconnection exponential backoff.
- Horizontally scale with sticky routing at the edge plus Redis pub/sub for game-event fan-out; correctness remains in PostgreSQL transaction serialization. Redis outage stops new socket fan-out safely but cannot lose committed state. Document precise degraded behavior before launch.
- Timer worker reads DB deadlines and uses a compare-and-swap/lock transaction; only one worker can resolve a deadline.

## 5. API, error and event contracts

### REST surface (v1)
`POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/password-reset/request`, `POST /auth/password-reset/confirm`, `POST /auth/email/verify`, `GET /me`, `GET /sessions`, `DELETE /sessions/{id}`, `POST /rooms`, `POST /rooms/{id}/join`, `POST /rooms/{id}/ready`, `POST /rooms/{id}/start`, `POST /realtime/ticket`, `GET /games/{id}`, `GET /games/{id}/events?after={seq}`, `GET /games/{id}/fairness`, `POST /reports`.

### WebSocket command envelope
```json
{
  "type": "game.roll",
  "version": 1,
  "request_id": "uuid",
  "game_id": "uuid",
  "expected_game_version": 17,
  "idempotency_key": "opaque client-generated key",
  "payload": {}
}
```

### Server event envelope
```json
{
  "type": "game.dice_rolled",
  "version": 1,
  "game_id": "uuid",
  "seq": 42,
  "ts": "RFC3339 UTC timestamp",
  "payload": {}
}
```

Unknown types/versions are rejected or ignored safely; payloads have schema/size limits. Events include no secret seed, raw token, password, private email, IP or moderation-only data.

### Stable API error-code catalogue
| Code | HTTP/transport use | Meaning |
|---|---|---|
| `AUTH_INVALID` | 401 | Credential/session/ticket invalid; generic externally. |
| `AUTH_REQUIRED` | 401 | No authenticated session. |
| `AUTH_FORBIDDEN` | 403 | Authenticated caller lacks permitted role/membership. |
| `RATE_LIMITED` | 429 | Limit reached; response has safe retry guidance. |
| `VALIDATION_FAILED` | 400 | Schema/range/format failure with no sensitive detail. |
| `RESOURCE_NOT_FOUND` | 404 | Resource absent or hidden consistently to prevent IDOR enumeration. |
| `ROOM_NOT_JOINABLE` | 409 | Full, expired, started or invalid room state. |
| `GAME_VERSION_CONFLICT` | 409 | Stale command; return current public version/sync instruction. |
| `COMMAND_REPLAY` | 200/409 | Idempotency key resolved; return original response where valid. |
| `TURN_NOT_ACTIVE` | 409 | Caller is not the active seat/phase. |
| `MOVE_ILLEGAL` | 422 | Requested move fails frozen rules. |
| `FAIRNESS_SETUP_FAILED` | 409 | Entropy/commit-reveal failed; room returned to lobby. |
| `SERVICE_DEGRADED` | 503 | Safe retry/reconnect; no state was silently applied. |
| `INTERNAL_ERROR` | 500 | Correlation ID only; no stack trace. |

## 6. Architecture decision

The provisional stack is recorded in [ADR/0001-stack.md](ADR/0001-stack.md): TypeScript monorepo, React web client, Node.js API/roll service, PostgreSQL, Redis and containers **[CONFIRM]**. The server shares a deterministic, pure rules/verifier package with offline verification tooling, but it remains the only authority that accepts live commands.

No secret or long-lived access token may be included in the client bundle or localStorage. Object storage is excluded from v1 unless avatar handling is approved **[CONFIRM]**.

## 7. Security, privacy and operations

[THREAT_MODEL.md](THREAT_MODEL.md), [LIVE_SECURITY.md](LIVE_SECURITY.md), [RUNBOOKS.md](RUNBOOKS.md) and [SECURITY.md](../SECURITY.md) are binding design requirements. They cover environment separation, secrets, CI/CD, branch protection, runtime hardening, application controls, auth, abuse detection, log redaction, backups, incident response, release gates and security regression protection.

Collect only the account/profile, match-integrity and security data needed to operate. Define privacy jurisdiction, minimum age, retention periods, privacy notice and terms before beta. Account deletion uses a documented pseudonymization/retention process; integrity proof records are not silently removed.

## 8. Delivery phases and definitions of done

1. **Design hardening (current):** documentation, ERD, rules, threat model, live controls, runbooks and repository hygiene.  
   **Done when:** docs cross-check passes; markdown/diagram/secret scans recorded; required confirmations are resolved; no app code exists.
2. **Foundation:** workspace, CI, lockfiles, environment contract, migrations framework, health/readiness, observability baseline, container baseline and secret injection.  
   **Done when:** reviewable PR; formatting/type/lint/test gates green; secret/dependency/SBOM/license scans green or accepted exception documented; non-root image and CI provenance checks pass; docs/progress evidence updated.
3. **Accounts/security:** registration/verification/login/reset/session lifecycle, rate limits, headers/CORS/CSRF, MFA admin path.  
   **Done when:** auth, session reuse, CSRF, IDOR, cookie/header and log-redaction tests green; security-path owner review; evidence recorded.
4. **Rules and fairness engine:** pure rules engine, golden scenarios, fairness vectors and verifier.  
   **Done when:** all golden/property/fairness-vector tests green; no seed-leak test green; independent review; evidence recorded.
5. **Private rooms:** room/invite/ready/start/rematch and authorization.  
   **Done when:** expiry, entropy setup, membership/IDOR/idempotency/concurrency tests green; feature flag defaults documented; evidence recorded.
6. **Realtime game:** ticketed WebSocket, serialization/outbox, reconnect, deadlines, completion/void/forfeit and proof release.  
   **Done when:** WebSocket authorization/origin/backpressure tests, reconnect storm, race/duplicate and outbox recovery tests green; evidence recorded.
7. **Accessible web client:** lobby/board/history/proof view, keyboard/mobile/reduced motion.  
   **Done when:** keyboard-only complete-match test, screen-reader announcements, contrast, touch-target and mobile-browser acceptance tests pass; evidence recorded.
8. **Operations/admin:** reports, limited moderation, admin isolation, continuous verifier, dashboards and alerts.  
   **Done when:** moderation authorization/audit tests, verifier mismatch alert test and runbook drill evidence are recorded.
9. **Hardening/release:** staging soak, independent assessment, load/chaos, restore drill, game day, privacy/terms and rollout controls.  
   **Done when:** all E11 launch gates in LIVE_SECURITY are evidenced. No real-user public launch before this gate.

Every phase is developed on a branch, reviewed through a PR, has CI/security checklist evidence and updates `progress.md` before the next phase. Hotfixes retain the mandatory security checks.

## 9. Verification strategy

- Unit/property tests: legal/illegal moves, boundaries, captures, safe squares, extra turns, terminal states and deterministic replays.
- Fairness tests: commitment/reveal validation, exact vectors, rejection sampling, fallback extension, seed non-disclosure, proof release and abort handling.
- Integration: transactions, locks/version conflicts, command retries, outbox recovery, reconnect, timers, seat authorization and migrations.
- Security: auth/session lifecycle, CSRF/CORS, IDOR, injection/XSS, WebSocket origin/message auth, rate limits, headers/cookies, secret scan and log redaction.
- End-to-end: full 2–4 player private-room match, reconnect, history and independent proof view.
- Load/chaos: concurrent games, reconnect storm, DB/Redis restart and failed fan-out; validate no duplicate/lost committed action.
- Accessibility: keyboard-only full match, screen reader status, contrast, reduced motion, touch target and supported mobile browser checks.
- Record exact command, environment, date and result in `progress.md`. A planned check is never reported as passed.

## 10. Open decisions requiring confirmation

1. **[CONFIRM] v1 rules preset:** adopt [RULES.md](RULES.md) proposed defaults, including safe squares, third-six rule, 30-second deadline and deterministic timeout move. Recommended: approve unchanged for a testable first release.
2. **[CONFIRM] v1 participant policy:** human authenticated accounts only; no bots/guests. Recommended: approve; it reduces fairness and abuse complexity.
3. **[CONFIRM] rematches:** multiple games per room, each with separate proof. Recommended: approve.
4. **[CONFIRM] transport:** plain WebSocket with 60-second, single-use REST-issued ticket. Recommended: approve.
5. **[CONFIRM] stack:** TypeScript monorepo, React, Node.js, PostgreSQL, Redis and containers. Recommended: approve.
6. **[CONFIRM] production region, scale, budget and data residency:** recommended: one managed production region near primary users, staging isolated, no production data outside production; set numeric capacity after load testing.
7. **[CONFIRM] privacy/age/legal baseline:** recommended: no under-13 users until legal review; publish privacy notice/terms before invite beta; decide governing jurisdiction with counsel.
8. **[CONFIRM] player MFA and avatar storage:** recommended: optional passkey/TOTP for players after v1; no uploaded avatars in v1.
9. **[CONFIRM] repository visibility and license:** repository is currently public; recommended: retain public only after secret scanning and branch protection are confirmed, and decide license in README before outside contributions.
10. **[CONFIRM] moderation coverage:** recommended: reports plus admin/moderator MFA and audited actions in v1; no chat until v1.1.
