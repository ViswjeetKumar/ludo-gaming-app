# Multiplayer Ludo — Product and Development Specification

**Status:** planning baseline; implementation has not started  
**Owner repo:** https://github.com/ViswjeetKumar/ludo-gaming-app  
**Last updated:** 2026-11-01

## 1. Product goal

Build a responsive web application for real-time 2–4 player Ludo. Players can register, create or join a room, invite friends, play a complete match, reconnect after network loss, and inspect a fairness record after the match. The server is authoritative for membership, turns, legal actions, dice outcomes, timers and final results.

“Fair” means rules and random outcomes are generated and checked by documented deterministic processes, with an audit trail to detect manipulation. No software can promise absolute fairness or eliminate every outage, compromised endpoint or collusion risk; communicate the guarantees and their limits plainly. No cash wagering, entry fees, prizes or real-money wallet are in scope unless separately specified and reviewed.

## 2. Product principles and release goals

- Same documented rules for every player in a match; explicit rules version stored with the match.
- No client decides dice, turn ownership, legal moves, capture, safe-square status or winner.
- Durable and replayable match history; reconnect does not reset or duplicate a move.
- Secure account/session handling, least data collection, abuse reporting, moderation and operational auditability.
- Keyboard accessible controls, readable contrast, responsive touch layout, reduced-motion option and clear connection state.
- First release focuses on private/friend rooms and public matchmaking with standard classic Ludo rules. Cosmetics, rankings and tournaments follow only after core integrity and operations are established.

## 3. Roles

- **Guest:** landing page and rules; can register/sign in.
- **Player:** profile, friends, rooms, invitations, matchmaking, live game, history, settings and reports.
- **Moderator:** review reports, mute/suspend accounts, terminate abusive rooms, with reason and audit record.
- **Administrator/on-call:** operational configuration and incident response; privileged actions require strong authentication and audit logging.

## 4. Functional requirements

### Accounts and profile
- Sign up/sign in, verified email, sign out all sessions, password reset with expiring single-use token; optional OAuth can be added later.
- Unique username, display name/avatar selection, privacy and notification preferences.
- View and revoke active sessions; account export/deletion workflow with documented retention exceptions for integrity records.
- Never reveal whether a submitted email exists in login/reset responses.

### Social and rooms
- Find friends by exact username, request/accept/decline/remove/block.
- Create private invite-code room or public room, choose 2–4 players and approved rule presets; host can start only when minimum seats are ready.
- Invite friends by in-app invite; bearer links are high-entropy, hashed at rest, single-use and expiring. Do not leak private room details to non-members.
- Join/leave/ready state, host handoff, room expiry, duplicate login/session handling and clear full/expired-room errors.
- Public matchmaking queue with region/latency preference and simple skill bands only after sufficient population; prevent queue farming.

### Gameplay
- Server creates immutable seat/color order, match ID, rules version and fairness commitment before first roll.
- Current player rolls through an authenticated command; server validates phase/turn, generates roll and legal options, applies selected move only if legal.
- Standard rules must be fully specified in `docs/RULES.md`: entry on six, extra roll policy, blockades, captures, safe squares, exact finish, three-sixes rule (if selected), turn timeout and disconnect policy. The initial rules preset must be agreed before code; defaults are documented and versioned.
- Clear animations are presentation only; authoritative state changes come from server events. Rejected commands return a stable error code and current version without hidden mutation.
- Reconnect fetches a sanitized snapshot plus events after last sequence number. If the sequence is outside retention, fetch a complete snapshot. Replays are idempotent.
- Disconnect grace period, reconnect countdown and eventual forfeit/seat takeover policy are visible before match start. Never silently change a human seat into a bot without the room's agreed rule.
- End match exactly once; record winner/placements, event log, roll proof and fairness reveal. Allow replayable history and report match.
- Optional in-game text chat with length limits, rate limits, block/mute/report and moderation filters.

### Fair randomness and audit
- Before the first roll, backend obtains a 256-bit server seed from the OS cryptographically secure random generator and publishes `SHA-256(server_seed)` in the match-start event.
- Versioned deterministic roll derivation: HMAC-SHA-256 keyed by server seed over canonical `game_id | turn_number | roll_index | purpose`. Convert bytes to 1..6 with rejection sampling to avoid modulo bias. Pin canonical encoding and test vectors in the fairness implementation.
- After completion or void, reveal the server seed. An independent verifier replays all rolls and checks the commitment, event sequence and rules version. Never reveal seed before terminal state.
- Future optional player entropy protocol: each player commits a random contribution before play and reveals after all commits; derive final seed from server secret plus verified contributions. Specify abort/missing-reveal behavior before enabling it.
- Store algorithm version and proof artifacts. Public proof omits email/IP/private chat. Log administrative rerolls as prohibited; if a match is voided, preserve original proof and reason.
- Fairness controls reduce unilateral manipulation; server compromise, collusion, or malicious clients remain residual risks. Document operations and incident reporting.

## 5. Non-functional and security requirements

### Security
- Threat model accounts, sessions, room codes, WebSocket commands, matchmaking, game state, chat, moderation tools, logs and deployment secrets.
- Use Argon2id (or a reviewed modern password hashing configuration), generic auth errors, email verification and rate limits for sign-in/reset/register.
- Short-lived access token; rotating refresh token in Secure, HttpOnly, SameSite cookie. CSRF protection for cookie-authenticated state changes; strict CORS allowlist. Store only refresh-token hashes; revoke on rotation reuse, logout, password change and account suspension.
- TLS only. Validate every request with schemas, length/range bounds and explicit authorization. Escape user-generated content; avoid unsafe HTML rendering. Set CSP, HSTS, frame/referrer/content-type protections, secure cookie policy and dependency scanning.
- WebSocket origin check, handshake authentication, per-message authorization, schema validation, per-user/IP rate limits, message size caps, heartbeat and connection caps. Never trust client clocks or state.
- Use parameterized SQL and least-privilege DB roles. Secrets in a managed secret store, never source control or client bundle. Encrypt backups and test restore.
- Prevent enumeration, brute force, CSRF, XSS, injection, IDOR, replay, race/duplicate commands, room-code guessing, socket flooding, chat abuse and moderator privilege escalation.
- Audit sensitive admin actions without logging passwords, tokens, raw reset links, private message content unnecessarily, or full IP data beyond defined security need/retention.
- Security incident runbook, dependency patch policy, backup/restore process, monitoring, alerting and rollback plan are release requirements.

### Reliability, performance and accessibility
- Target p95 command acknowledgement < 500 ms within selected deployment region (excluding animation); reconnect snapshot < 2 s for ordinary match.
- One region initially; define service objectives, graceful degradation and maintenance behavior before launch.
- Durable transaction first, broadcast second. Transactional outbox or equivalent ensures committed events are eventually delivered after restart.
- Health/readiness checks, structured logs with correlation IDs, metrics for queue, command latency, errors, disconnects and fairness verification.
- WCAG 2.2 AA as a target: keyboard operation, focus visibility, labels, color not sole state cue, screen-reader status announcements and reduced motion.
- Support current Chrome, Edge, Firefox, Safari plus mobile browsers; feature-detect WebSocket and fall back to reconnect UI (not a silent insecure transport).

## 6. Proposed architecture

Choose a TypeScript monorepo unless discovery shows an existing stack to preserve:
- `apps/web`: React + TypeScript UI, accessible board, room/lobby, auth and history.
- `apps/api`: Node.js + TypeScript REST API and Socket.IO/WebSocket gateway; shared pure Ludo rules engine.
- `packages/game-engine`: deterministic, side-effect-free rules and fairness verifier shared by server and replay tooling. Server remains authoritative.
- PostgreSQL for durable data; Redis for presence, matchmaking coordination and rate-limit counters.
- Managed object storage only if user avatars/replays require it; upload validation and private ACLs.
- Container-based deployment behind TLS reverse proxy/WAF, with separate dev/staging/prod, migrations, secret manager and CI security checks.
- No client-side secret. Browser persists only non-sensitive UI preferences; do not place long-lived tokens in localStorage.

Stack is provisional until repository/source discovery; retain useful existing code rather than replacing it blindly.

## 7. API and event contracts

REST examples: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /me`, `POST /rooms`, `POST /rooms/{id}/join`, `POST /rooms/{id}/invites`, `POST /matchmaking/tickets`, `GET /games/{id}`, `GET /games/{id}/events?after={seq}`, `GET /games/{id}/fairness`, `POST /reports`.

Socket client commands: `room.ready`, `game.roll`, `game.move`, `game.resign`, `game.chat.send`. Each carries request ID/idempotency key and expected game version where relevant. Server events: `room.updated`, `game.started`, `game.dice.rolled`, `game.move.applied`, `game.turn.changed`, `game.player.disconnected`, `game.player.reconnected`, `game.finished`, `game.voided`. Events have monotonically increasing sequence and version. Use a versioned envelope; reject unknown schema versions safely.

## 8. Data, privacy and retention

Collect only username, verified email, profile preferences, match events and essential abuse/security telemetry. Define jurisdiction/age assumptions before public launch. Publish privacy notice and terms before real users. Set retention periods for auth/security logs, chat, reports and account deletion. User deletion pseudonymizes or removes profile data while preserving minimal match-integrity records where justified. Provide data access/export workflow. Do not sell or expose game behavior as public profile data by default.

## 9. Delivery phases and acceptance gates

1. **Discovery/design:** inspect repo, agree exact Ludo rule preset, UX scope, regions/hosting, privacy/age assumptions and initial visibility. Approve ERD and this spec. Deliver rules doc and threat model.
2. **Foundation:** monorepo, CI, formatting/type checks, environment config, DB migrations, health endpoints, observability baseline and secret handling.
3. **Accounts/security:** registration, verification, login, refresh rotation, reset, session revocation, profiles, rate limits and security headers.
4. **Rules engine:** typed state/actions, classic rules, deterministic replay and fairness verifier with published test vectors; persistence-independent and reviewed.
5. **Rooms/social:** private/public rooms, invite handling, ready/start, friends/blocking and matchmaking.
6. **Realtime match:** server-authoritative command loop, persistence/outbox, reconnect/resync, timers, termination and fairness proof.
7. **Web client:** responsive accessible board/lobby, connection UX, history and fairness verifier display.
8. **Abuse/admin:** reports, mute/block, moderation audit, operational tooling and incident playbooks.
9. **Hardening/release:** security review, load/reconnect/fault-injection checks, backup restore, staging soak, privacy/terms, alerting and rollback. No launch until critical/high security findings are resolved.

A phase is complete only when acceptance criteria and verification evidence are recorded in progress.md. Do not describe an unrun check as passed.

## 10. Verification strategy

- Unit/property tests: every legal/illegal move, all board boundaries, captures, safe squares, extra turns, turn transitions, finish conditions and seeded deterministic replays.
- Fairness vectors: commitment verification, deterministic roll sequence, rejection sampling boundary cases, no seed leakage before terminal state, reveal/abort behavior.
- Integration: transaction rollback, optimistic-version conflicts, idempotency duplicates, concurrent roll/move attempts, outbox recovery, reconnect/resync and seat authorization.
- Security: auth/session lifecycle, CSRF/CORS, IDOR, injection/XSS, WebSocket origin and per-message controls, rate limits and secret scanning.
- End-to-end: create/join full 2–4 player room, complete match, disconnect/reconnect, inspect proof and reload match history.
- Load/chaos: concurrent rooms, socket reconnect storms, DB/Redis restart and failed event broadcast. Validate recovery and no duplicated or lost committed moves.
- Accessibility: keyboard-only game flow, screen reader updates, contrast and reduced motion.
- These are planned checks. Report actual command, environment, result and date per run.

## 11. Open decisions before implementation

1. Exact rules preset (especially three sixes, safe squares, capture bonus and timeout/disconnect/forfeit behavior).
2. Solo practice/bots in first release or multiplayer only.
3. Public matchmaking and friend system in first release or private rooms first.
4. Guest play, OAuth provider and email service.
5. Hosting region, expected launch scale, budget and data residency.
6. Whether chat is required in first release.
7. Branding, board style, accessibility language/localization and mobile-first priority.
8. Privacy jurisdiction, minimum age and moderation coverage.
9. Repository state/branch workflow and whether the repository should remain public or become private.
