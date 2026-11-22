# Releases, rollback and Docker

## Versions
Production is whatever is on `main`; Vercel deploys every merge. A **tag** marks a known-good
production version so you know exactly what to roll back to.

- `v1.0.0` is the first Vercel production release.
- Use [semver](https://semver.org): `v1.1.0` for new features, `v1.0.1` for fixes only.

### Cutting a release
After merging and checking production:

```sh
git checkout main && git pull
git tag v1.1.0
git push origin v1.1.0
```

`.github/workflows/release.yml` then:
1. creates the GitHub release with notes generated from the merged PRs;
2. publishes the Docker image `ghcr.io/<owner>/martlet:v1.1.0` (and `:latest`).

## Rolling back
- **Fastest (Vercel):** in Vercel, go to Deployments, find the deployment for the tag's commit and choose **Instant Rollback** (or **Promote to Production**). No rebuild is needed.
- **In git:** revert the bad PR's merge commit on `main` (`git revert -m 1 <merge-sha>`) and open a PR. Avoid force-pushing `main`.
- **Database:** migrations aren't rolled back automatically. If a release added one, check whether the older code still works with the newer schema. Additive migrations (new tables, functions or grants) usually do.

## Docker
A multi-stage `Dockerfile` builds Next's standalone server. Vercel doesn't use it.

| Stage | What it does |
|---|---|
| `deps` | `npm ci` from the lockfile, with a cached npm store |
| `build` | `next build` with `NEXT_OUTPUT=standalone` |
| `run` | Alpine with only `server.js`, `.next/static` and `public/`, a non-root user and a health check |

```sh
# Production-like local run (reads .env)
docker compose up --build

# Or by hand
docker build -t martlet \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... .
docker run -p 3000:3000 --env-file .env martlet
```

- `NEXT_PUBLIC_*` values are compiled into the browser bundle, so they are **build args**. Server-only secrets go in at **run time** (`--env-file`) and never in the image.
- Without Supabase values, the image runs in demo mode. CI builds the image and smoke-tests it on every PR.
- For release images, set the `NEXT_PUBLIC_*` values as GitHub repository **variables** (Settings → Secrets and variables → Actions → Variables).
