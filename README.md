# ThesisWatch

ThesisWatch is a workspace for tracking stocks and recording investment research. The local prototype lets you add and remove tickers, read an illustrative NVDA thesis, and save a research note per ticker. Watchlist entries and notes live in browser storage. Removing a ticker keeps its note available if you add it again.

## Run the prototype

Install Node.js 24 and pnpm 11.25.0. From the repository root, run:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev
```

Open [the dashboard](http://127.0.0.1:5173). The API status in the header checks [the health endpoint](http://127.0.0.1:5173/api/health) through Vite. The Worker also listens directly on port 8787. The prototype uses sample data and browser storage and requires no API keys or accounts.

## Verify changes

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`apps/web` holds the React dashboard. `apps/api` holds the Hono Worker. `packages/shared` defines the health endpoint contract. See the [Phase 1 spec](docs/phase1-spec.md) for the broader product scope.

## To do

- [ ] Add a VS Code Dev Container with Node.js 24 and pnpm 11.25.0. Install dependencies from the lockfile and forward the dashboard port.
- [ ] Verify that a fresh clone runs on another machine using the README, including the dashboard and API health check. The setup should work with a fresh pnpm cache.
- [ ] Confirm GitHub Actions passes lint, type checks, tests, and builds from a clean checkout.
