# Querium — LLM Data Analyst Agent

Querium is a production-style AI data analyst: you ask a question in plain language, the
agent inspects the database schema, writes read-only SQL, runs it, charts the result,
draws diagrams and explains what the numbers mean — with every step visible.

Built for the Sairam Hackathon 2026 "LLM Agent + Database + Visualization" challenge.

## What it does

- **Natural-language → SQL → answer**, in a streaming multi-turn chat.
- **Full transparency**: the exact SQL, row counts and execution time are shown for every query.
- **Live visualizations**: bar, line, area, pie and scatter charts (Recharts).
- **Diagrams**: Mermaid ER diagrams, workflows and decision trees.
- **Insights**: structured headline / findings / trend / recommendation summaries.
- **Reasoning trace**: the model's thinking is streamed into a collapsible panel.

## The five required agent tools

| Tool | What it does |
| --- | --- |
| `get_schema` | Returns tables, columns, types, nullability and foreign-key relationships. |
| `execute_query` | Runs a validated read-only `SELECT`/`WITH` statement and returns rows + stats. |
| `generate_chart` | Picks a chart type, axes and series for a result set, with a stated reason. |
| `generate_flowchart` | Emits Mermaid for ER diagrams, workflows and decision trees. |
| `explain_data` | Turns a result set into plain-language insights, trend and recommendation. |

The agent runs a tool loop (plan → schema → query → visualize → diagram → explain → answer)
and can chain up to 50 steps per turn.

## How it works

### 1. You ask a question

The composer in `ChatWindow` posts the whole message list to the streaming endpoint
`POST /api/chat`. The request carries the thread id and a `confirmSql` flag (set by the
"Confirm SQL" switch). Voice input is just the Web Speech API writing text into the same
composer.

### 2. The request is authenticated and persisted

The endpoint verifies the caller's bearer token against Lovable Cloud auth, confirms the
thread belongs to that user, and writes the new user message to `messages` before any model
call. If the thread has no title yet, one is derived from this first question.

### 3. The model runs a tool loop

`streamText` is called with the system prompt, the conversation so far, and the five tools.
Reasoning is enabled, so the model's thinking streams into the collapsible panel while it
works. Each step the model either calls a tool or writes prose:

```text
question
  ↓
get_schema ──────────► tables, columns, foreign keys
  ↓
execute_query ───────► validated SELECT → rows + timing
  ↓
generate_chart ──────► runs its own SELECT → chart spec
generate_flowchart ──► Mermaid source
explain_data ────────► headline, findings, trend, recommendation
  ↓
final markdown answer
```

Tool results are streamed to the browser as typed parts, not text. `ToolPartView`
dispatches each part to a real component — `SchemaCard`, `QueryResultCard`, `ChartCard`,
`DiagramCard`, `InsightCard` — so a chart is an interactive Recharts figure and a diagram is
rendered Mermaid, while the raw tool input/output stays inspectable in a collapsed row.

### 4. SQL goes through three gates

Every statement the model writes is checked before it touches data: the tool schema accepts
a single statement, a server-side validator rejects anything that is not `SELECT`/`WITH`,
and the database function `demo_run_select` re-validates it, blocks restricted objects,
applies a statement timeout and caps rows. With "Confirm SQL" on, `execute_query` is marked
`needsApproval`, so the loop pauses and shows you the exact SQL with Approve / Reject before
it runs.

### 5. Results are saved and reusable

When the turn finishes, the assistant message (including all tool parts) is stored so the
thread replays exactly as it happened, and every executed statement is appended to
`query_history` with its row count and duration. From there you can favourite it, delete it,
or re-run it into a fresh conversation. Any chart or table can be pinned to `/dashboard`,
where tiles can be reordered or removed. Result sets export to CSV; charts and diagrams
export to PNG.


## Bonus features implemented

- **SQL transparency + explanation** on every query card.
- **Query history** (`/history`): every executed statement, with favourites, delete and
  one-click re-run into a fresh conversation.
- **Pinned dashboard** (`/dashboard`): pin any chart or table, then reorder or remove tiles.
- **Exports**: CSV for any result set, PNG for any chart or diagram.
- **Voice input**: dictate questions via the Web Speech API (hidden where unsupported).
- **Confirm-before-execute**: a composer toggle puts SQL behind a human approval gate
  (AI SDK tool approval) before it runs.
- **Threaded history**: conversations persist per user with dedicated `/c/:threadId` URLs.

## Safety model

The agent can only read. Three independent layers enforce it:

1. The tool schema accepts a single statement and the prompt forbids writes.
2. A server-side validator rejects anything that is not `SELECT`/`WITH`, contains multiple
   statements, or mentions write/administrative keywords.
3. The database function `demo_run_select` re-validates the statement, blocks restricted
   objects (auth, storage, vault, chat tables), applies a 10s statement timeout and caps
   results at 5000 rows.

Chat threads, messages, query history and dashboard tiles are protected by row-level
security scoped to the signed-in user.

## Demo database

A `demo` schema seeded with two years of realistic sales data:

- `customers` (country, segment, signup date)
- `products` (category, price, cost)
- `orders` (~3,200 orders, status, channel, order date)
- `order_items` (~6,400 line items, quantity, unit price, discount)

Roughly $6.2M of revenue to slice by month, country, segment, channel and category.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | TanStack Start (React 19 + Vite, SSR + server functions) |
| Agent runtime | Vercel AI SDK v7 (`streamText`, tool calling, tool approval) |
| Model | Lovable AI Gateway (OpenAI Responses API, reasoning enabled) |
| Database + auth | Lovable Cloud (Postgres + row-level security) |
| Charts | Recharts · Diagrams: Mermaid · Exports: html-to-image |
| UI | Tailwind v4, shadcn/ui, AI Elements chat primitives |

## Project map

```text
src/lib/agent/tools.server.ts     the five tools + system prompt
src/lib/agent/db.server.ts        schema inspection + guarded SQL runner
src/routes/api/chat.ts            streaming chat endpoint, persistence, approval gate
src/lib/threads.functions.ts      thread + message CRUD (server functions)
src/lib/workspace.functions.ts    query history + dashboard tiles
src/components/agent/             chat window, sidebar, chart/table/diagram/insight cards
src/routes/_authenticated/        chat, dashboard and history pages
```

## Running it

Sign in with Google or email, and ask something like:

- "Show me monthly revenue for the last 12 months"
- "Which 10 products drive the most revenue?"
- "Draw an ER diagram of this database"
- "How does revenue split by country, and what stands out?"


