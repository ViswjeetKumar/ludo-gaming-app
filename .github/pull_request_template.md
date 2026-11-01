## Summary

Describe the user-visible and security impact.

## Verification

- [ ] I ran relevant tests and recorded the command/result.
- [ ] I updated documentation and `progress.md` where required.
- [ ] I checked migrations for expand/contract compatibility.
- [ ] I considered rollback and feature-flag/kill-switch behavior.

## Security checklist

- [ ] No secret, token, seed, personal data or production configuration is included.
- [ ] Input validation and authorization are covered for changed REST/WebSocket flows.
- [ ] Idempotency, concurrency and event ordering are covered for changed game commands.
- [ ] Fairness vectors/proof behavior are covered when dice or game engine changes.
- [ ] Logging redacts credentials, seeds and personal data.
- [ ] Dependency, SBOM, license, secret and image scans pass or have an approved exception.
- [ ] CODEOWNERS review is requested for security-critical paths.
