# Курс · RUB Route Rates

[![Check](https://github.com/KobaLuck/rub-route-rates/actions/workflows/ci.yml/badge.svg)](https://github.com/KobaLuck/rub-route-rates/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**See how many rubles a dollar, a hryvnia, or 1,000 Vietnamese dong cost — with daily FX data, historical charts, and an iPhone widget.**

[Live dashboard](https://rub-route-rates.boldmite258.chatgpt.site) · [JSON API](https://rub-route-rates.boldmite258.chatgpt.site/api/rates) · [Scriptable widget](https://rub-route-rates.boldmite258.chatgpt.site/#install)

The interface is in Russian. Rates are fetched by the server, without an AI agent or an always-on personal computer. The project runs on Cloudflare Workers and keeps its latest snapshot and historical observations in R2.

## What it does

- Shows RUB per USD, RUB per UAH, and RUB per 1,000 VND.
- Opens the relevant chart when a currency card is selected.
- Compares the current publication with the previous 30 and 365 calendar days.
- Highlights a new low with an on-page banner and a distinct widget appearance.
- Calculates the ruble cost of a chosen UAH or VND amount through USD.
- Provides a public JSON endpoint and a medium-size Scriptable widget with a **Графики** button.
- Keeps the previous snapshot when the upstream service fails; reports failed refreshes and stale data.

## Rates and calculations

The upstream source is [Currency API](https://github.com/fawazahmed0/exchange-api), a daily reference-rate dataset. The server tries jsDelivr first and Cloudflare Pages second. The bundled bootstrap archive contains observations from 2025 onward; absent observations remain `null`.

Given the number of units of each currency per USD:

```text
RUB per USD       = rub
RUB per UAH       = rub / uah
RUB per 1,000 VND = rub / vnd × 1,000
```

Lower ruble cost is better. These are reference cross-rates through **USD**. They do not include transaction fees or separate buy/sell spreads. They are **not** USDT prices, executable P2P offers, or an average of Bybit advertisements.

### When a signal appears

The current publication is excluded from its own comparison window. A signal requires a strictly lower price than the best available prior observation: at least 20 observations for the 30-day window, or 240 for the 365-day window. Annual signals take precedence. Counts and dates are included in the response; these thresholds do not prove complete historical coverage.

Signals are suppressed for stale data, a failed refresh, or a snapshot checked on a previous day in `Asia/Ho_Chi_Minh`. They are marked preliminary when the exact quote time is unknown or the comparison window contains missing observations. The iPhone widget provides a **visual indicator**, not push notifications; iOS controls its actual refresh time.

## Run locally

Requires **Node.js 22+**. Build, preview, and tests use Node's standard library; no application dependencies need to be installed.

```bash
git clone https://github.com/KobaLuck/rub-route-rates.git
cd rub-route-rates
npm run check
npm run preview
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317).

The lightweight preview uses the bundled snapshot and does not persist runtime changes. Tests exercise automatic retrieval and R2 writes with controlled provider/storage substitutes. For the Cloudflare runtime and live refresh behavior, use Wrangler with the R2 binding described below.

## Deploy to Cloudflare Workers

The live instance is deployed through Sites. A standalone deployment can use the included Wrangler configuration:

```bash
npx wrangler login
npx wrangler r2 bucket create rub-route-rates-data
npm run build
npx wrangler deploy
```

Set a different bucket name in `wrangler.jsonc` if needed. Once you know your deployment's HTTPS origin, rebuild and redeploy with:

```bash
PUBLIC_SITE_URL=https://your-worker.example.workers.dev npm run build
npx wrangler deploy
```

`PUBLIC_SITE_URL` sets the API/chart origin embedded in the downloadable widget. It defaults to the live demo. `.openai/hosting.example.json` documents the optional Sites deployment bindings; the live deployment's project identity is not included in this repository.

### Runtime configuration

| Setting | Purpose |
| --- | --- |
| `BUCKET` | R2 binding for persisted snapshots and historical observations. |
| `AUTO_SOURCE_ENABLED=true` | Enables upstream refresh; set in `wrangler.jsonc`. |
| `PUBLIC_SITE_URL` | Optional build-time HTTPS origin for the widget. |
| `OWNER_EMAIL` | Optional secret used only by the legacy archive writer behind Sites authentication. |

No market-data API key is required. Do not configure `OWNER_EMAIL` on a standalone public deployment without an authentication gateway that strips client-supplied identity headers and supplies verified identity. The current dashboard does not need this writer.

## Refresh behavior

```text
Dashboard / Scriptable
        |
        v
GET /api/rates --> R2 snapshot --> cross-rates + comparisons
        |
        +-- cache expired --> Currency API / fallback --> validate --> R2
```

Refresh is **request-driven**, not a cron job. An open page checks the server every five minutes; the widget requests hourly refresh, subject to iOS scheduling. The server checks upstream at most hourly per persisted successful refresh. The provider publishes daily data, so an hourly check does not imply hourly market observations.

On a new publication, the previous current rate moves into history. A refresh also tries to recover up to five missing historical dates. The bootstrap dataset and previously stored records keep the application useful during an outage. Failed refreshes do not advance the successful-check timestamp.

## API

### `GET /api/rates`

Returns the current snapshot, daily history, computed summaries, and visible opportunities. Responses use `Cache-Control: no-store`.

```json
{
  "source": "Currency API",
  "sourceDate": "YYYY-MM-DD",
  "updatedAt": "ISO-8601 timestamp",
  "lastCheckedAt": "ISO-8601 timestamp",
  "quoteTime": null,
  "current": { "rub": 80, "vnd": 25000, "uah": 40 },
  "history": [],
  "summary": { "rub": {}, "rubvnd": {}, "rubuah": {} },
  "opportunities": [],
  "stale": false
}
```

The example is abbreviated and its numbers are illustrative. `sourceDate` is the provider's publication date; `updatedAt` is the server's check time. `rubvnd` uses **1,000 VND**, while `rubuah` uses **1 UAH**. Each summary has `d30` and `d365` entries with a best value, observation count, dates, record flag, and improvement percentage. A retained snapshot may also include `refreshError`.

### Other routes

| Route | Purpose |
| --- | --- |
| `GET /` | Mobile-friendly dashboard. |
| `GET /widget.js` | Downloadable Scriptable script. |
| `POST /mcp` | Optional Sites MCP interface: `read_rates` and an owner-only legacy Google-archive writer. |

The legacy writer stores a separate archive and cannot replace the dashboard's current Currency API snapshot. Personal Google Sheets links, account data, and credentials are not part of the public API.

## iPhone widget

1. Install [Scriptable](https://scriptable.app/).
2. Open the dashboard's **Виджет для iPhone** section and copy the script.
3. Create a Scriptable script named **Курс**, paste the code, and save it.
4. Add a **medium** Scriptable widget and select the script.

The widget shows all three ruble prices, retains an offline snapshot, and opens the chart page through **Графики ↗**. Updating this repository does not replace code already saved on an iPhone; copy the new script when its layout or behavior changes.

## Project layout

```text
worker/
  index.js              Worker routes, refresh logic, storage, and comparisons
  page.html             Dashboard, SVG charts, and conversion calculator
  widget.js             Scriptable widget
  seed.json             Public Currency API bootstrap history
scripts/
  build.mjs             Embed page, widget, and bootstrap data into one Worker
  test.mjs              Rates, signals, caching, storage, and access-control checks
  preview.mjs           Lightweight local preview
  validate-artifact.mjs ESM/build validation
  fetch-history.mjs     Optional upstream historical-data refresh
wrangler.jsonc          Standalone Cloudflare deployment configuration
```

## Development

Run `npm run check` before sending changes. CI runs the same command on pushes and pull requests. Tests do not require a live provider, Cloudflare credentials, or a personal account. Keep public-rate data separate from credentials, account details, and private archives.

Code is licensed under [MIT](LICENSE). Currency API's upstream dataset is published under [CC0-1.0](https://github.com/fawazahmed0/exchange-api/blob/main/LICENSE).
