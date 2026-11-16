# ThesisWatch — Phase 1 Specification

**Status:** Draft v1.0 · **Target:** 2027 · **Owner:** ThesisWatch

## Product objective
Ship a small, elegant, demonstrable **production-grade AI investment research SaaS** that (1) is tested by real investors, (2) demonstrates practical AI Engineer skills, and (3) helps track the user's own stock investment theses. Favor a reliable end-to-end workflow over a broad feature list.

## Phase 1 scope
1. **Accounts and watchlists:** Secure sign-in; every user may create, rename, and delete multiple watchlists; add/remove any stock in the supported universe. Per-user/per-stock preferences are stored in the schema for future monitoring.
2. **Autonomous research:** A user selects a stock and starts an asynchronous AI research job. The agent gathers evidence from official filings, investor relations, and web search; distinguishes facts from interpretations; and reports missing evidence.
3. **Structured thesis:** Schema-validated bull/bear cases, key assumptions, catalysts, risks, invalidation conditions, investment horizon, uncertainty, and dated source citations. Verify claims and numerical facts against attributable sources where feasible.
4. **Persistent history:** Save each completed thesis as an immutable version with ticker/security identity, source provenance, research timestamp, schema/model/prompt versions, and job metadata. Allow a user to regenerate and review historical versions.
5. **Premium dashboard:** Responsive, accessible watchlist and thesis views with clear research progress, failure states, source links, and history.

**Demo tickers:** NVDA, QCOM, HPE — examples only, never hard-coded restrictions.

## Proposed technology
- **Frontend:** React, TypeScript, Tailwind CSS, shadcn/ui; Recharts or Apache ECharts.
- **API and hosting:** Cloudflare Workers and Cloudflare-hosted frontend.
- **Research orchestration:** OpenAI Responses API with web search; durable Cloudflare Workflows/Queues for background jobs.
- **Database and auth:** Supabase PostgreSQL and Supabase Auth.
- **Engineering:** GitHub monorepo, GitHub Actions CI/CD, automated tests, structured logs, error monitoring.
- **Later extensions:** Replaceable financial data providers, Reddit/social sentiment, Python analytics, valuation, simulated portfolios.

## Non-negotiable architecture requirements
- **Customizable & multi-tenant:** Users, securities, watchlists, membership, research preferences, and thesis versions are relational data, not static lists. Enforce authorization and PostgreSQL Row Level Security.
- **Expandable:** Modular frontend/API/agent/data-source interfaces; versioned schemas and migrations; no provider-specific assumptions in core domain logic.
- **Scalable at low initial cost:** Queue long-running jobs; cap concurrency, API usage, and per-user spend; cache/deduplicate permissible company-level research; measure load before upgrading infrastructure.
- **Trustworthy:** Preserve source URLs, timestamps and financial reporting periods; treat retrieved content as untrusted; test for prompt injection, fabricated citations and incorrect numerical claims.
- **Production discipline:** Separate local/staging/production configuration; managed secrets; CI checks; retry/idempotency for jobs; backups and tested recovery; monitoring and rollback plan.

## Phase 1 acceptance criteria
- A new test user can sign in and independently create and customize multiple watchlists.
- Research works for supported stocks beyond the three demonstration tickers.
- One request completes end-to-end: **select stock → research → validate structured output → persist → display**.
- Reports cite inspectable sources and retain immutable versions after regeneration.
- Background job failures are visible and recoverable; user data is isolated.
- Automated lint/type/unit/integration/E2E checks pass, and approved commits deploy via CI/CD.
- A secure live application and a five-minute walkthrough are available to potential users/employers.
- Collect structured feedback from approximately ten real investors during a limited beta.

## Exclusions and constraints
No brokerage integration, live trading, automated buy/sell execution, large-scale social scraping, advanced ML, or quantitative backtesting in Phase 1. Scheduled thesis-change monitoring is Phase 2; Phase 1 stores the necessary history and preferences. Commercial market-data and content use must be licensed appropriately before a public beta. **Development infrastructure target: < US$50/month**, subject to actual model/API consumption.
