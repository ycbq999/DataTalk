# Deployment runbook

GitHub Actions verifies both applications and builds a Linux production image containing Django, Gunicorn, and the compiled React dashboard. The web service and the optional research worker use the same image digest. A release to production uses the digest that passed staging.

## Local development

Install Docker with the Compose plugin. On Windows, use Docker Desktop with its Linux/WSL 2 backend. From a fresh checkout, run:

~~~sh
docker compose up --build -d
~~~

Open [the dashboard](http://127.0.0.1:5173/) or [Django admin](http://127.0.0.1:8000/admin/). Local services use PostgreSQL, apply migrations before starting Django, and publish only Vite and Django to localhost. Changes to Python and React source reload. After editing dependencies or Vite configuration, rebuild the corresponding image.

The defaults are for local use. Copy `.env.example` to `.env` to override them. Keep the database passwords URL-safe for Compose's connection strings. Changing a password in `.env` does not rotate an existing database role. Bring services down with `docker compose down` to retain the local database volume.

For local AI research, set `RESEARCH_ENABLED=1` and an `OPENAI_API_KEY` in `.env`, then run `docker compose --profile research up --build`. The worker gets the key. Django sends jobs to a private Redis container. If enabling the profile against an existing backend, recreate the web service so it sees the new feature flag.

## One-time setup per hosted environment

Render is the initial provider. Create separate staging and production services, databases, and secrets, using the same settings and deployment steps. A web-only environment can operate with research disabled.

1. Wait for the first successful main CI run. Its summary contains the image digest in GitHub Container Registry. Add a Render registry credential with read access to that private package. Use the digest reference when creating an image-backed service.
2. Create a managed PostgreSQL database. Use its original owner credentials for migrations. Connect as that owner and run `infra/postgres/runtime-role.sql` using `psql -f` in the application database with `THESISWATCH_DB_APP_PASSWORD` supplied via your local process environment. It creates `thesiswatch_app` and grants access to the owner's tables and sequences, including those created by future migrations. Keep this role separate from the migration owner and any role capable of bypassing row security. Use private database URLs for hosted app services, and restrict external database access after provisioning.
3. Create the paid image-backed **web service**. Keep the image's default start command, set the health check to `/api/v1/ready/`, and set its pre-deploy command to `env MIGRATE_DB=1 python manage.py migrate --noinput`. Fill in the environment variables below before first deployment. The entry command removes the migration credential from Gunicorn's environment. Render still stores it as a web service secret and injects it into Render-managed shells. Restrict service-shell and configuration access accordingly. The worker never needs this secret.
4. To enable research, create a persistent Redis-compatible Key Value service with `noeviction` and a background **worker** from the same image digest. Set its Docker Command to `celery -A config worker --loglevel INFO --concurrency=1`. Give it the worker settings below and a shutdown grace period long enough for in-flight work to acknowledge or finish, within provider limits. Configure the web application to use that same broker only after the worker is ready.
5. Create a separate Django administrator with `python manage.py createsuperuser` in the web service shell. Open `/admin/` over HTTPS to manage accounts and the supported stock catalog. Visitors can create ordinary accounts from the public home page.

| Environment variable | Web | Worker |
| --- | --- | --- |
| `DATABASE_URL` | Private connection for `thesiswatch_app` | Same environment's runtime role |
| `MIGRATION_DATABASE_URL` | Private connection for the migration owner | Leave unset |
| `DJANGO_SECRET_KEY` | Unique randomized key of at least 50 characters per environment | Same environment's key |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated service hostnames without scheme | Same setting |
| `DJANGO_TRUST_PROXY_HTTPS` | `1` behind Render's TLS proxy | Leave unset |
| `DJANGO_DEBUG` | `0` or unset | `0` or unset |
| `RESEARCH_ENABLED` | `1` once broker and worker are available | `1` |
| `CELERY_BROKER_URL` | Private broker connection when enabled | Same environment's broker |
| `OPENAI_API_KEY` | Leave unset | Environment-specific key |
| `OPENAI_MODEL` | Same configured model as worker or leave both at the default | Model used by the provider |
| `RESEARCH_DAILY_LIMIT`, `RESEARCH_GLOBAL_DAILY_LIMIT`, `RESEARCH_MAX_ATTEMPTS` | Start with conservative settings and adjust from observed usage | Use matching settings |

Django uses one origin for the dashboard and API. Keep secure cookies and HTTPS redirects at their defaults in hosted environments. The app image contains prebuilt assets and has no runtime Node requirement.

## GitHub release configuration

Add these Actions **secrets** to the private repository:

- `RENDER_STAGING_API_KEY`
- `RENDER_PRODUCTION_API_KEY`

Use the narrowest Render token permissions that permit triggering and reading deploys for the target services. Restrict who can update GitHub workflows and repository secrets. Enable required pull request reviews and status checks on `main` where supported by the repository plan.

Add Actions **variables** for each target, with `<TARGET>` equal to `STAGING` or `PRODUCTION`:

- `RENDER_<TARGET>_WEB_SERVICE_ID`
- `RENDER_<TARGET>_WORKER_SERVICE_ID`, blank for web-only releases
- `RENDER_<TARGET>_URL`, the public HTTPS origin with no path

To release a change:

1. Open a pull request and verify CI passes. Merge the reviewed change to `main`.
2. Wait for the new main CI run. It publishes one image and records its digest.
3. Run **Release verified image** from `main` with `staging` and the successful **CI run ID**. Use the numeric ID in the Actions run URL. The workflow deploys the digest, waits for Render, checks the API and dashboard assets, and deploys the optional worker.
4. Browse stocks while signed out. Register a test account, create a watchlist, add a supported ticker, and check that a second account cannot see it. If research is enabled, complete a small live research run and open its citations before promotion.
5. Run the same workflow from `main` with `production` and the successful **staging release run ID**. It accepts the staged digest and requires matching worker deployment mode. Check the resulting production deployment and service alerts.

The production dispatch is manual and works without GitHub's paid environment review rules. For environments with separate approvers and a GitHub plan that supports protection rules for the repository, set up protected deployment environments before broadening repository write access.

## Rollback and operations

- Keep the current and previous image digests available in GitHub Container Registry. If a deployment fails, check the Render deploy ID and logs before retrying. Use the release workflow with the earlier successful staging run, or Render's rollback if the Actions evidence expired. Keep the web and worker on compatible versions.
- Use additive migrations while the previous image can continue running. The database migration can outlive an application rollback. For data loss or irreversible schema changes, use a database recovery plan, verify the restored instance, and deliberately switch connections.
- Turn on managed PostgreSQL point-in-time recovery before storing real data. Practice a restore in an isolated instance. Verify that restored security policies and runtime grants still block cross-account access.
- The app limits login and signup attempts by the network peer. If a reverse proxy makes the app see one peer for many visitors, use per-client limits at the edge before opening registration to heavy traffic. Expired rows in `core_authwindow` can be pruned periodically.
- Monitor web errors, database availability, and worker failures. Track queued jobs and provider calls. After a broker or worker outage, run `python manage.py recover_research` from a service with the runtime role and broker access. It re-enqueues eligible interrupted jobs and prints a continuation cursor for batches. Review recurring failures before retrying again.
- Start with one web instance and one worker. Increase workers as queue wait rises, and review database connections and provider limits before increasing web concurrency or research caps. Keep staging separate from production data and remove temporary staging resources when they are no longer needed.

[Render prebuilt images](https://render.com/docs/deploying-an-image) · [Render deployment lifecycle](https://render.com/docs/deploys) · [Render PostgreSQL recovery](https://render.com/docs/postgresql-backups)
