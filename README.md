# EDA Agent

An AI-powered exploratory data analysis agent. Upload a CSV, ask questions in plain English, and get back interactive charts or computed results — all in a notebook-style UI.

The workspace has two packages:

- **`eda_agent`** — Node.js/TypeScript backend. Runs a WebSocket server, orchestrates an LLM workflow, and delegates data work to a Python subprocess (pandas + LIDA).
- **`eda_agent_notebook`** — React + Vite frontend. Connects to the backend over WebSocket and renders results as notebook cells.

## Installation

### Prerequisites

- Node.js 20+ and yarn
- Python 3.10+

### 1. Backend

```bash
cd eda_agent
yarn install        # also runs pip install -r requirements.txt
cp .env.sample .env
```

Edit `.env` and fill in the required variables:

A [Gemini API key](https://aistudio.google.com/app/apikey) is required when using the Gemini provider.

### 2. Frontend

```bash
cd eda_agent_notebook
yarn install
```

## Running

```bash
# terminal 1 — backend (default port 3001)
cd eda_agent && yarn server

# terminal 2 — frontend (production build, default port 4173)
cd eda_agent_notebook && yarn start
```

For frontend development with hot reload, use `yarn dev` instead of `yarn start`.

Open `http://localhost:5173`, load a CSV, and start asking questions.
