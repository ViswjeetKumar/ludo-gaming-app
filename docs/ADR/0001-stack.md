# ADR 0001: Initial application stack

**Status:** Accepted  
**Date:** 2026-11-01  
**Approved:** 2026-11-01

## Decision

Use a TypeScript monorepo with:

- React + TypeScript for the mobile-first web client.
- Node.js + TypeScript for REST API, WebSocket gateway and separate roll/fairness service boundary.
- PostgreSQL as durable transactional store and authoritative event log.
- Redis only for presence, rate limits, transient command coordination and fan-out; never sole game state.
- Containerized builds/deployments with managed secret store, KMS, PostgreSQL and Redis.

## Rationale

One typed language reduces contract drift across browser, API and deterministic rules/verifier tooling. PostgreSQL provides transactions, locks, constraints and durable event history required for command serialization and fairness evidence. Redis lowers realtime fan-out/presence latency without changing authority. Containers make runtime hardening/provenance/repeatable deploys practical.

## Alternatives considered

| Alternative | Reason not selected initially |
|---|---|
| Separate frontend/backend languages | Adds contract/tooling complexity before gameplay is proven. |
| Firebase/serverless-only state | Could simplify startup but makes transactional per-game command ordering, DB roles and replay/audit control less direct. |
| Socket.IO | Useful fallback/rooms abstraction, but v1 needs plain WebSocket only to make transport/ticket semantics and scaling surface explicit. |
| Client-authoritative rules/randomness | Rejected: cannot meet anti-cheat/fairness requirements. |
| Redis as source of game state | Rejected: transient cache cannot be sole integrity record. |
| Kubernetes from day one | Deferred: managed container platform is simpler until load evidence needs orchestration complexity. |

## Consequences

- Phase 2 must set up strict workspace boundaries, lockfiles, tests, CI, container hardening and provider-neutral configuration.
- The pure game engine must not access network, clock, database or cryptographic seed storage.
- Production needs a KMS/secret manager and separate DB roles.
- A later ADR must choose hosting region/provider, email provider and concrete WebSocket edge/fan-out implementation.

No dependency, runtime, package manifest or source folder is created by this ADR.
