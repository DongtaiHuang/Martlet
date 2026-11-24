# Roadmap

The roadmap is the issue tracker. This page explains how to read it, so it can't go out of date.

| Label | Meaning | Open issues |
|---|---|---|
| `next` | Agreed and planned; pick these up first | [next](https://github.com/DongtaiHuang/Martlet/issues?q=is%3Aopen+label%3Anext) |
| `later` | Wanted, not scheduled | [later](https://github.com/DongtaiHuang/Martlet/issues?q=is%3Aopen+label%3Alater) |
| `deferred` | Parked on purpose (privacy, safety, legal or cost); the issue says why | [deferred](https://github.com/DongtaiHuang/Martlet/issues?q=is%3Aopen+label%3Adeferred) |
| `bug` | Something is broken | [bugs](https://github.com/DongtaiHuang/Martlet/issues?q=is%3Aopen+label%3Abug) |
| `good first issue` | Small and self-contained | [good first issues](https://github.com/DongtaiHuang/Martlet/issues?q=is%3Aopen+label%3A%22good+first+issue%22) |

Flags that change how an idea is built:

- `epic`: a large idea split into sub-issues.
- `needs-adr`: write an ADR in [adr/](adr/README.md) before writing code.
- `privacy`: touches personal data. Check ADR 0008 (no user positions) and Law 25.
- `ugc`: user-generated content, so it needs reporting and moderation (ADR 0027).

## Picking something up

1. Comment on the issue so two people don't build the same thing.
2. Branch from the latest `main` (see [AGENTS.md](../AGENTS.md)) and link the issue in your PR with `Closes #N`.
3. Moving an idea between `next`, `later` and `deferred` is a team decision. Say why in a comment on the issue.
