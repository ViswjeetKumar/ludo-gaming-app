# Security Policy

## Reporting a vulnerability

Please do not report security vulnerabilities in public issues, discussions, pull requests or social media.

Preferred contact: GitHub private vulnerability reporting for this repository, once the repository setting is enabled. Until that setting is verified, use no public issue, discussion, pull request or social-media channel for vulnerability details.

A useful report includes affected component/version, reproduction steps, impact, exploit conditions and any suggested mitigation. Please avoid accessing other users' data, altering games, degrading service or publishing proof-of-concept details.

## Scope

In scope: repository source/configuration, CI/CD workflows, authentication/session handling, WebSocket/ticket handling, room access, game command authorization, fairness/seed handling, data exposure, infrastructure configuration controlled by this project and supported production deployments.

Out of scope: social engineering, physical attacks, denial-of-service against third parties, testing without authorization, vulnerabilities in unsupported forks, and findings requiring compromised user devices without a project-specific weakness.

## Supported versions

No application release exists yet. Until a release policy is established, only the future latest `main` release candidate is intended to receive security fixes. This policy will be updated before invite beta.

## Response targets

The project aims to acknowledge reports within 3 business days, share a status update within 7 days and prioritize confirmed critical issues according to [RUNBOOKS.md](docs/RUNBOOKS.md). Timelines may change with incident scope; public disclosure is coordinated after users can protect themselves.

## Safe harbor

Good-faith security research that follows this policy and avoids privacy/service harm will be treated as authorized for the limited purpose of reporting the issue. This statement does not grant access to systems or data outside the project scope.
