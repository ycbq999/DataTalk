# DataTalk

Repository: [ycbq999/DataTalk](https://github.com/ycbq999/DataTalk).

DataTalk pairs a public dashboard of market sentiment, global indices, and upcoming events with a private research workspace. The public dashboard uses sample data. Create an account to organize stocks into named watchlists, save notes, and compare citation-backed thesis versions. The Django API and React dashboard share a domain in production. PostgreSQL stores user data. A separate Celery worker runs optional OpenAI research.

## Run on either computer

Install Docker with the Compose plugin. For an existing installation, follow the [DataTalk rename upgrade steps](docs/deployment.md#upgrading-an-existing-installation-to-datatalk) first to keep using its database and volumes. From a clean Git checkout:

```sh
docker compose up --build -d
```

Open [DataTalk](http://127.0.0.1:5173/) to explore the **World Stories** dashboard. Use **Sign up** to create an account or **Sign in** to open your existing workspace. Create a watchlist, add a stock such as MSFT, and save a note.

To manage the catalog and accounts in [Django admin](http://127.0.0.1:8000/admin/), create a separate operations account with `docker compose exec web python manage.py createsuperuser`.

Compose runs a one-time migration service before the web app starts. The database volume preserves watchlists and notes across restarts. Each computer builds its own dependencies from Git and the lockfiles. Browser notes from the original prototype are not imported automatically.

## Develop in GitHub Codespaces

Once the `.devcontainer` files are on GitHub, open the repository and choose **Code → Codespaces → Create codespace**. If you already have a codespace, run **Codespaces: Rebuild Container** from the command palette after pulling the new files.

Run this in the browser editor's terminal:

```sh
bash .devcontainer/compose.sh up --build -d
```

In the **Ports** tab, open **DataTalk** on port **5173** and keep its visibility **Private**. The preview uses the codespace's own PostgreSQL database. Sign up there if you're using it for the first time. The script configures the forwarded HTTPS address for Vite and Django, so signup and sign-in work through the preview.

When you're done, stop the codespace from [your Codespaces list](https://github.com/codespaces). To stop the app while keeping the codespace open, run `bash .devcontainer/compose.sh stop`.

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
