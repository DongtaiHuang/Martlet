# Martlet docs

Everything about building, running and deciding things for Martlet lives here, versioned with the code and reviewed in pull requests. There's no wiki: a page that isn't reviewed with the code drifts.

## Start here

| If you want to… | Read |
|---|---|
| Know what Martlet is and run it locally | [README](../README.md) |
| Contribute code (checks, commits, branches, security rules) | [AGENTS.md](../AGENTS.md) (written for people and AI agents) |
| Understand how the app works, without coding experience | [Crash course](CRASH_COURSE.md) (covers the MVP; later features are in the ADRs) |
| See what's planned | [Roadmap](ROADMAP.md) |

## Reference

| Topic | Doc |
|---|---|
| Database setup, migrations in order, test accounts | [SUPABASE_SETUP.md](SUPABASE_SETUP.md) |
| Production on Vercel, admin settings, rollback | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Versions, tags, Docker image, rollback | [RELEASES.md](RELEASES.md) |
| Service function signatures components rely on | [CONTRACTS.md](CONTRACTS.md) |
| Why things are the way they are | [Architecture decisions (ADRs)](adr/README.md) |
| Who reviews which area | [`.github/CODEOWNERS`](../.github/CODEOWNERS) |
| App screenshots | [screenshots/](screenshots/) |

## Archive

Historical, kept for context only: [the hackathon starter](archive/MARTLET_START_HERE.md) and [the 24-hour team plan](archive/TEAM_PLAN.md).

## Keeping docs current

- A PR that changes behaviour updates the doc that describes it in the same PR.
- A new migration gets a row in [SUPABASE_SETUP.md](SUPABASE_SETUP.md#2-apply-migrations-in-order) and a SQL test in `tests/`.
- A new decision gets an ADR, and the [ADR index](adr/README.md) is updated when it merges.
