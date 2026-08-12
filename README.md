# Querium — LLM Data Analyst Agent

A production-style AI data analyst that turns plain-language questions into live SQL queries, visual charts, and structured insights—with complete transparency at every step.

**Live Demo:** https://querium.vercel.app/

**Demo Username:** admin@querium.com

**Password:** queirum
---

## Overview

Querium answers your data questions in natural language. Ask a question, and the agent inspects the database schema, writes read-only SQL, executes it, generates charts and diagrams, and explains the findings—all streamed in real time with full visibility into the reasoning and SQL.

Built for the **Sairam Hackathon 2026** "LLM Agent + Database + Visualization" challenge.

### Key Features

- **Natural-language → SQL → answer** in a streaming multi-turn chat
- **SQL transparency**: every query is shown with row counts and execution time
- **Live visualizations**: bar, line, area, pie, and scatter charts (Recharts)
- **Diagrams**: Mermaid ER diagrams, workflows, and decision trees
- **Structured insights**: headlines, findings, trends, and recommendations
- **Reasoning trace**: model thinking streamed into a collapsible panel
- **Query history**: save, favorite, and re-run executed queries
- **Pinned dashboard**: curate and reorder your favorite analyses
- **Voice input**: dictate questions via Web Speech API
- **SQL approval gate**: optionally confirm SQL before execution
- **Exports**: CSV for tables, PNG for charts and diagrams

---

## The Five Agent Tools

| Tool | Purpose |
| --- | --- |
| `get_schema` | Inspects tables, columns, types, nullability, and foreign-key relationships |
| `execute_query` | Runs validated read-only `SELECT`/`WITH` statements and returns rows + stats |
| `generate_chart` | Selects chart type, axes, and series for result sets with reasoning |
| `generate_flowchart` | Emits Mermaid diagrams (ER, workflows, decision trees) |
| `explain_data` | Converts result sets into plain-language insights and recommendations |

---

## How It Works

### Request Flow

```
Question (Chat)
    ↓
[Authentication & Persistence]
    ↓
[Model Tool Loop]
    ├→ get_schema ────────→ table structure
    ├→ execute_query ────→ SELECT results + timing
    ├→ generate_chart ───→ interactive chart
    ├→ generate_flowchart → Mermaid diagram
    └→ explain_data ─────→ insights & recommendations
    ↓
[Streaming Response + Save to History]
```

### SQL Safety (3-Layer Protection)

1. **Tool schema**: enforces single `SELECT`/`WITH` statement, forbids writes
2. **Server validator**: rejects non-`SELECT`, multiple statements, restricted keywords
3. **Database function**: re-validates, blocks restricted objects, applies 10s timeout, caps rows at 5000

All queries are read-only. Conversations are protected by row-level security scoped to the signed-in user.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Framework** | TanStack Start (React 19 + Vite, SSR + server functions) |
| **Agent Runtime** | Vercel AI SDK v7 (streamText, tool calling, tool approval) |
| **Model** | AI Gateway (OpenAI Responses API, reasoning enabled) |
| **Database & Auth** | Cloud (Postgres + row-level security) |
| **Visualization** | Recharts (charts) · Mermaid (diagrams) · html-to-image (exports) |
| **UI Framework** | Tailwind CSS v4 · shadcn/ui · AI Elements |

---

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm/yarn
- A Cloud account (Postgres database + authentication)
- OpenAI or compatible API key (via AI Gateway)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd querium
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or yarn install
   ```

3. **Configure environment variables**
   
   Create a `.env.local` file in the project root:
   ```env
   # Database (Cloud/Postgres)
   DATABASE_URL=postgres://user:password@host/database

   # Authentication
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret

   # AI Gateway & Model
   AI_GATEWAY_API_KEY=your_ai_gateway_key
   AI_MODEL=openai/gpt-4-turbo  # or your configured model

   # Optional: Content Security Policy
   VITE_FRONTEND_URL=http://localhost:5173
   ```

4. **Initialize the database**
   
   Run migrations and seed the demo schema:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:5173`

### Deployment

The project is configured for Vercel:

```bash
npm run build
# Deploy to Vercel (or your host)
vercel deploy
```

For Cloud Functions, ensure your deployment environment has the same `.env` variables set.

---

## Project Structure

```
src/
├── lib/
│   ├── agent/
│   │   ├── tools.server.ts      # Five agent tools + system prompt
│   │   └── db.server.ts         # Schema inspection + guarded SQL runner
│   ├── threads.functions.ts     # Thread & message CRUD (server functions)
│   └── workspace.functions.ts   # Query history + dashboard tiles
├── routes/
│   ├── api/
│   │   └── chat.ts              # Streaming chat endpoint, persistence, approval
│   └── _authenticated/
│       ├── c/[threadId].tsx     # Chat view
│       ├── history.tsx          # Query history page
│       └── dashboard.tsx        # Pinned results dashboard
├── components/
│   ├── agent/
│   │   ├── ChatWindow.tsx       # Main chat UI
│   │   ├── Sidebar.tsx          # Navigation & thread list
│   │   ├── ToolPartView.tsx     # Dispatcher for tool results
│   │   ├── ChartCard.tsx        # Recharts wrapper
│   │   ├── DiagramCard.tsx      # Mermaid diagram renderer
│   │   ├── QueryResultCard.tsx  # Table display + export
│   │   └── InsightCard.tsx      # Findings & recommendations
│   └── ui/                      # shadcn/ui components
└── assets/                      # Images, fonts, static files
```

---

## Demo Database

A realistic sales dataset (`demo` schema):

- **customers** (3,500): country, segment, signup date
- **products** (150): category, price, cost
- **orders** (~3,200): status, channel, order date
- **order_items** (~6,400): quantity, unit price, discount

**~$6.2M revenue** across 2 years, sliceable by month, country, segment, channel, and category.

### Example Queries

Try asking Querium:

- "Show me monthly revenue for the last 12 months"
- "Which 10 products drive the most revenue?"
- "Draw an ER diagram of this database"
- "How does revenue split by country, and what stands out?"
- "What's our customer acquisition trend over time?"
- "Compare revenue by segment and channel"

---

## Key Features in Detail

### SQL Transparency & Approval

Every query Querium writes is shown with syntax highlighting. Enable "Confirm SQL" to require approval before execution.

### Query History

Navigate to `/history` to browse all executed queries, mark favorites, delete queries, and re-run any query into a fresh conversation.

### Pinned Dashboard

Pin charts and tables to `/dashboard`. Reorder tiles by drag-and-drop or remove them as your analysis evolves.

### Exports

- **Tables**: export result sets to CSV
- **Charts**: export visualizations to PNG
- **Diagrams**: export Mermaid renders to PNG

### Voice Input

Use your browser's microphone to dictate questions (Web Speech API, hidden where unsupported).

---

## Team

| Role | Name |
| --- | --- |
| **Team Lead** | Harish S T |
| **Backend** | Ajay Thiraviya Doss J |
| **Frontend** | Hariharan M |
| **Database & Architecture** | Harish S T |
| **Testing & Allocation** | Kishor M |
| **Contributions** | Arvish B |

---

## License

Built for the Sairam Hackathon 2026. See LICENSE for details.

---

## Support & Feedback

For issues, questions, or feedback:
1. Check the [GitHub Issues](https://github.com/kishor-m7/querium/issues)
2. Start a new discussion or open an issue with details and screenshots
3. Contact the team via [hackathon organizers]

---

**Made with ❤️ by the Querium Team**
