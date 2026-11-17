# ThesisWatch

ThesisWatch is a private workspace for stock research. Organize stocks into named watchlists, save notes, and compare citation-backed thesis versions. The Django API and React dashboard share a domain in production. PostgreSQL stores user data. A separate Celery worker runs optional OpenAI research.

## Run on either computer

Install Docker with the Compose plugin. From a clean Git checkout:

```sh
docker compose up --build -d
docker compose exec web python manage.py createsuperuser
```

Open [ThesisWatch](http://127.0.0.1:5173/) and sign in. Create a watchlist, search for a supported stock such as MSFT, add it, and save a note. [Django admin](http://127.0.0.1:8000/admin/) manages accounts and the starter US securities catalog. The admin account is intended for local setup and operations. Create ordinary accounts for testers.

Compose runs a one-time migration service before the web app starts. The database volume preserves watchlists and notes across restarts. Each computer builds its own dependencies from Git and the lockfiles. Browser notes from the original prototype are not imported automatically.

## Enable research locally

Copy `.env.example` to `.env`, set `RESEARCH_ENABLED=1`, enter your own `OPENAI_API_KEY`, and start the extra services:

```sh
docker compose --profile research up --build -d
```

The worker validates the report and matches citation URLs to the provider's retrieved sources before saving a version. This check establishes source provenance. Review the supporting documents to assess factual claims. Research is disabled by default and normal tests use fixtures. Requests, tokens, and searches are bounded. The live provider path requires a configured key and a staging smoke test before release.

## Verify changes

```sh
docker compose run --rm migrate python manage.py makemigrations --check --dry-run
docker compose run --rm migrate python manage.py test
docker compose run --rm frontend pnpm lint
docker compose run --rm frontend pnpm typecheck
docker build --target production .
```

GitHub Actions verifies the two stacks, tests access using a restricted database role, and smoke-tests the production image in a browser before publishing the artifact. The [deployment runbook](docs/deployment.md) covers staging, promotion, rollback, and operations. The [Phase 1 specification](docs/phase1-spec.md) describes the release criteria.
