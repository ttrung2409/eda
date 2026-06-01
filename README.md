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

```
# "gemini" or "ollama"
LLM_PROVIDER=

# Gemini (required when LLM_PROVIDER=gemini)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash-lite

# Ollama (required when LLM_PROVIDER=ollama)
OLLAMA_MODEL=llama3.1:8b
```

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

# terminal 2 — frontend (default port 5173)
cd eda_agent_notebook && yarn dev
```

Open `http://localhost:5173`, load a CSV, and start asking questions.
