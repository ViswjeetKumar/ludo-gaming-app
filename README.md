# Multiplayer Ludo

A planned real-time, 2–4 player web Ludo game with server-authoritative rules and independently verifiable dice.

**Status:** Design hardening and v1 decisions are complete. No application code, dependencies or runtime configuration have been added. Implementation waits for an explicit `GO`.

## Fairness in plain language

Before a game starts, the server commits to a hidden random seed. Every player also commits to their own random nonce and reveals it after all commitments exist. The combined seed produces every dice result with a fixed published algorithm. When a game ends or is voided, players can verify the commitment, nonce reveals, dice sequence, rules version and event hash chain.

This makes unexpected roll changes detectable. It cannot guarantee that a compromised server, colluding insider or an abort before game start never affects availability or choice to start; those risks are monitored, audited and covered by incident runbooks.

## Documentation

- [Development specification](docs/DEVELOPMENT_SPEC.md)
- [Entity relationship diagram](docs/ERD.md)
- [Rules and golden scenarios](docs/RULES.md)
- [Fairness algorithm and verified vectors](docs/FAIRNESS_VECTORS.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Live security requirements](docs/LIVE_SECURITY.md)
- [Incident runbooks](docs/RUNBOOKS.md)
- [Stack ADR](docs/ADR/0001-stack.md)
- [Requirements traceability](docs/TRACEABILITY.md)
- [Security disclosure policy](SECURITY.md)
- [Progress log](progress.md)

## Security reporting

Please follow [SECURITY.md](SECURITY.md). Do not open a public issue for a suspected vulnerability.

## License

No license grant is published. Public visibility does not grant reuse rights.
