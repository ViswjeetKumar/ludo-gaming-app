# Multiplayer Ludo — ERD

**Status:** design baseline (2026-11-01)  
**Repository:** https://github.com/ViswjeetKumar/ludo-gaming-app

PostgreSQL is the durable source of truth. Redis may coordinate presence, matchmaking and rate limits, but no accepted move or fairness evidence may exist only in Redis.

```mermaid
erDiagram
  USERS ||--o{ AUTH_IDENTITIES : links
  USERS ||--o{ REFRESH_SESSIONS : opens
  USERS ||--o| PLAYER_PROFILES : has
  USERS ||--o{ GAME_ROOMS : hosts
  USERS ||--o{ ROOM_MEMBERS : joins
  USERS ||--o{ GAME_SEATS : plays
  USERS ||--o{ GAME_INVITES : sends_or_receives
  USERS ||--o{ FRIENDSHIPS : relates
  USERS ||--o{ CHAT_MESSAGES : sends
  USERS ||--o{ MODERATION_ACTIONS : receives
  GAME_ROOMS ||--o{ ROOM_MEMBERS : contains
  GAME_ROOMS ||--o{ GAME_INVITES : issues
  GAME_ROOMS ||--o| GAMES : starts
  GAMES ||--|{ GAME_SEATS : assigns
  GAMES ||--o{ GAME_TURNS : records
  GAMES ||--o{ DICE_ROLLS : records
  GAMES ||--o{ GAME_EVENTS : appends
  GAMES ||--o| FAIRNESS_PROOFS : proves
  GAMES ||--o{ CHAT_MESSAGES : contains
  GAME_SEATS ||--o{ GAME_TURNS : takes
  GAME_TURNS ||--o{ DICE_ROLLS : contains
  USERS ||--o{ GAME_TURNS : acts
  USERS ||--o{ DICE_ROLLS : requests

  USERS {
    uuid id PK
    citext username UK
    citext email UK
    text password_hash
    text status
    timestamptz created_at
    timestamptz deleted_at
  }
  AUTH_IDENTITIES {
    uuid id PK
    uuid user_id FK
    text provider
    text provider_subject
    timestamptz created_at
  }
  REFRESH_SESSIONS {
    uuid id PK
    uuid user_id FK
    text token_hash UK
    timestamptz expires_at
    timestamptz revoked_at
  }
  PLAYER_PROFILES {
    uuid user_id PK,FK
    text display_name
    text avatar_key
    jsonb preferences
  }
  GAME_ROOMS {
    uuid id PK
    uuid host_user_id FK
    text join_code UK
    text visibility
    text status
    smallint capacity
    jsonb rules
    timestamptz expires_at
  }
  ROOM_MEMBERS {
    uuid room_id PK,FK
    uuid user_id PK,FK
    text status
    timestamptz joined_at
  }
  GAME_INVITES {
    uuid id PK
    uuid room_id FK
    uuid sender_user_id FK
    uuid recipient_user_id FK
    text token_hash
    text status
    timestamptz expires_at
  }
  GAMES {
    uuid id PK
    uuid room_id FK
    text status
    bigint version
    smallint active_seat_index
    jsonb state_snapshot
    bytea seed_commitment
    timestamptz started_at
    timestamptz finished_at
  }
  GAME_SEATS {
    uuid id PK
    uuid game_id FK
    uuid user_id FK
    smallint seat_index
    text color
    text status
    jsonb pieces
    timestamptz joined_at
  }
  GAME_TURNS {
    uuid id PK
    uuid game_id FK
    uuid seat_id FK
    integer turn_number
    text status
    text action_type
    jsonb action_payload
    uuid idempotency_key UK
    bigint version_before
    timestamptz completed_at
  }
  DICE_ROLLS {
    uuid id PK
    uuid game_id FK
    uuid turn_id FK
    uuid seat_id FK
    integer roll_index
    smallint outcome
    bytea proof_digest
    timestamptz created_at
  }
  GAME_EVENTS {
    uuid id PK
    uuid game_id FK
    bigint sequence_number
    text event_type
    jsonb public_payload
    bytea previous_hash
    bytea event_hash
    timestamptz created_at
  }
  FAIRNESS_PROOFS {
    uuid game_id PK,FK
    bytea commitment
    bytea revealed_seed
    text algorithm_version
    jsonb player_entropy_commitments
    timestamptz revealed_at
  }
  FRIENDSHIPS {
    uuid id PK
    uuid requester_id FK
    uuid addressee_id FK
    text status
    timestamptz updated_at
  }
  CHAT_MESSAGES {
    uuid id PK
    uuid game_id FK
    uuid room_id FK
    uuid sender_user_id FK
    text body
    text moderation_state
    timestamptz created_at
    timestamptz deleted_at
  }
  MODERATION_ACTIONS {
    uuid id PK
    uuid moderator_user_id FK
    uuid target_user_id FK
    uuid game_id FK
    text action
    text reason_code
    timestamptz expires_at
  }
```

## Constraints and integrity

- `AUTH_IDENTITIES`: unique(provider, provider_subject). `REFRESH_SESSIONS` stores only a hash of a high-entropy opaque token; rotate on use and revoke by session.
- Rooms support 2–4 seats. A started match freezes its participants, seat indices, colors and rules. Unique(game_id,user_id), (game_id,seat_index), and (game_id,color) constraints prevent duplicate seats.
- A game version increases on every accepted state transition. A command names its expected version and an idempotency key. Apply it in one transaction with row locking or compare-and-swap; stale/replayed requests cannot move a piece or roll again.
- Turns are ordered and scoped to the active seat. Dice outcomes are server-generated and constrained 1..6. Store roll proof and the turn/action that consumed it.
- `GAME_EVENTS` is append-only and sequence-numbered. Hash each canonical event with the previous hash to reveal deletion or reorder attempts; keep personal data out of public payloads.
- Publish `seed_commitment = SHA-256(server_seed)` before the first roll. After match end or void, reveal the seed and algorithm version so clients can independently recompute every roll. Never expose the seed while play is active.
- An invite stores only a hash of its random bearer token, is single-use, scoped to a room and expires. Friendship pair uniqueness uses a canonical pair check.
- Chat has exactly one scope (room or game). Moderation actions and fairness records are retained as append-only audit facts. Account deletion must not cascade-delete completed matches or proofs.
- Enforce foreign keys, check constraints, indexes on active games/rooms, participant lookups, event sequence, expiry and moderation queues. Define explicit retention/deletion rules for personal data.
