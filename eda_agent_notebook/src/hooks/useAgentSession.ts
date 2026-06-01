import { useCallback, useEffect, useRef, useState } from "react";
import type { Cell, ClientMessage, DatasetInfo, FollowUpExchange, Goal, HistoryMessage, ServerMessage } from "../types";

const WS_URL = "ws://localhost:3001";

type SessionState =
  | { phase: "idle" }
  | { phase: "connecting" }
  | { phase: "loading"; status: string }
  | { phase: "ready" }
  | { phase: "running"; status: string }
  | { phase: "clarifying"; question: string }
  | { phase: "error"; message: string };

export function useAgentSession() {
  const wsRef = useRef<WebSocket | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>({ phase: "idle" });
  const [dataset, setDataset] = useState<DatasetInfo | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastPersonaRef = useRef<string | undefined>(undefined);

  const activeCellIdRef = useRef<string | null>(null);
  // -1 = updating main cell output; >=0 = updating followUps[idx]
  const activeFollowUpIdxRef = useRef<number>(-1);
  const [lastCompletedCellId, setLastCompletedCellId] = useState<string | null>(null);

  // ── helpers ────────────────────────────────────────────────────────────────

  function send(msg: ClientMessage) {
    wsRef.current?.send(JSON.stringify(msg));
  }

  function updateActiveCell(updater: (cell: Cell) => Cell) {
    const id = activeCellIdRef.current;
    if (!id) return;
    setCells((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  }

  function updateActiveFollowUp(updater: (f: FollowUpExchange) => FollowUpExchange) {
    const id = activeCellIdRef.current;
    const idx = activeFollowUpIdxRef.current;
    if (!id || idx < 0) return;
    setCells((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          followUps: c.followUps.map((f, i) => (i === idx ? updater(f) : f)),
        };
      })
    );
  }

  function updateActiveOutput(
    cellUpdater: (cell: Cell) => Cell,
    followUpUpdater: (f: FollowUpExchange) => FollowUpExchange
  ) {
    if (activeFollowUpIdxRef.current >= 0) {
      updateActiveFollowUp(followUpUpdater);
    } else {
      updateActiveCell(cellUpdater);
    }
  }

  // ── server message handler ─────────────────────────────────────────────────

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case "status":
        setSessionState((prev) => {
          if (prev.phase === "loading") return { phase: "loading", status: msg.message };
          if (prev.phase === "running" || prev.phase === "clarifying")
            return { phase: "running", status: msg.message };
          return prev;
        });
        updateActiveOutput(
          (c) => ({ ...c, status: msg.message }),
          (f) => ({ ...f, status: msg.message })
        );
        break;

      case "summary":
        setDataset({ name: msg.name, columns: msg.columns, shape: msg.shape });
        setSessionState({ phase: "ready" });
        break;

      case "clarifyQuestion":
        setSessionState({ phase: "clarifying", question: msg.question });
        updateActiveOutput(
          (c) => ({ ...c, clarifyQuestion: msg.question, status: null }),
          (f) => ({ ...f, clarifyQuestion: msg.question, status: null })
        );
        break;

      case "chartHtml":
        updateActiveOutput(
          (c) => ({ ...c, output: { kind: "chart", html: msg.html, explanation: msg.explanation, goal: msg.goal }, status: null, clarifyQuestion: null }),
          (f) => ({ ...f, output: { kind: "chart", html: msg.html, explanation: msg.explanation, goal: msg.goal }, status: null, clarifyQuestion: null })
        );
        break;

      case "textResult":
        updateActiveOutput(
          (c) => ({ ...c, output: { kind: "text", result: msg.result, explanation: msg.explanation }, status: null, clarifyQuestion: null }),
          (f) => ({ ...f, output: { kind: "text", result: msg.result, explanation: msg.explanation }, status: null, clarifyQuestion: null })
        );
        break;

      case "goals": {
        setGoals((prev) => [...prev, ...msg.goals]);
        setLoadingMore(false);
        setSessionState({ phase: "ready" });
        break;
      }

      case "error":
        updateActiveOutput(
          (c) => ({ ...c, output: { kind: "error", message: msg.message }, status: null, clarifyQuestion: null }),
          (f) => ({ ...f, output: { kind: "error", message: msg.message }, status: null, clarifyQuestion: null })
        );
        setLoadingMore(false);
        setSessionState({ phase: "ready" });
        break;

      case "done":
        setLastCompletedCellId(activeCellIdRef.current);
        activeCellIdRef.current = null;
        activeFollowUpIdxRef.current = -1;
        setSessionState({ phase: "ready" });
        break;
    }
  }, []);

  // ── connect ────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  function connect() {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
    }
    setSessionState({ phase: "connecting" });
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        handleMessage(JSON.parse(e.data as string) as ServerMessage);
      } catch {
        console.error("Failed to parse server message", e.data);
      }
    };
    ws.onerror = () => {
      setSessionState({ phase: "error", message: "WebSocket connection failed. Is the eda_agent server running?" });
    };
    ws.onclose = () => {
      setSessionState((prev) =>
        prev.phase === "idle" ? prev : { phase: "error", message: "Connection closed" }
      );
    };
    return ws;
  }

  // ── public API ─────────────────────────────────────────────────────────────

  function init(filePath: string) {
    const ws = connect();
    setDataset(null);
    setCells([]);
    setGoals([]);
    setSessionState({ phase: "loading", status: "Initialising..." });
    ws.onopen = () => { send({ type: "init", filePath }); };
  }

  function runQuery(text: string, history: HistoryMessage[] = []) {
    if (sessionState.phase !== "ready") return;
    const id = crypto.randomUUID();
    const cell: Cell = { id, query: text, clarifications: [], output: null, status: "Thinking...", clarifyQuestion: null, followUps: [] };
    setCells((prev) => [...prev, cell]);
    activeCellIdRef.current = id;
    activeFollowUpIdxRef.current = -1;
    setGoals([]);
    setSessionState({ phase: "running", status: "Thinking..." });
    send({ type: "query", text, history });
  }

  function runFollowUp(cellId: string, text: string) {
    if (isRunning) return;
    const cell = cells.find((c) => c.id === cellId);
    if (!cell) return;

    const history = buildHistory(cell);
    const newFollowUp: FollowUpExchange = { question: text, clarifications: [], clarifyQuestion: null, output: null, status: "Thinking..." };
    const followUpIdx = cell.followUps.length;

    setCells((prev) =>
      prev.map((c) => c.id === cellId ? { ...c, followUps: [...c.followUps, newFollowUp] } : c)
    );
    activeCellIdRef.current = cellId;
    activeFollowUpIdxRef.current = followUpIdx;
    setSessionState({ phase: "running", status: "Thinking..." });
    send({ type: "query", text, history, isFollowUp: true });
  }

  function answerClarify(answer: string) {
    setSessionState({ phase: "running", status: "Thinking..." });
    updateActiveOutput(
      (c) => ({
        ...c,
        clarifications: c.clarifyQuestion ? [...c.clarifications, { question: c.clarifyQuestion, answer }] : c.clarifications,
        clarifyQuestion: null,
        status: "Thinking...",
      }),
      (f) => ({
        ...f,
        clarifications: f.clarifyQuestion ? [...f.clarifications, { question: f.clarifyQuestion, answer }] : f.clarifications,
        clarifyQuestion: null,
        status: "Thinking...",
      })
    );
    send({ type: "clarifyAnswer", answer });
  }

  function requestSuggest(persona?: string) {
    if (sessionState.phase !== "ready") return;
    lastPersonaRef.current = persona;
    setGoals([]);
    setLoadingMore(false);
    setSessionState({ phase: "running", status: "Generating suggestions..." });
    send({ type: "suggest", persona });
  }

  function loadMoreSuggestions() {
    setLoadingMore(true);
    send({ type: "suggest", persona: lastPersonaRef.current, existingGoals: goals.map((g) => g.question) });
  }

  function pickSuggestion(index: number) {
    const goal = goals[index - 1];
    if (!goal) return;
    const id = crypto.randomUUID();
    const cell: Cell = { id, query: goal.question, clarifications: [], suggestions: { goals, pickedIndex: index - 1 }, output: null, status: "Thinking...", clarifyQuestion: null, followUps: [] };
    setCells((prev) => [...prev, cell]);
    activeCellIdRef.current = id;
    activeFollowUpIdxRef.current = -1;
    setGoals([]);
    setSessionState({ phase: "running", status: "Thinking..." });
    send({ type: "query", text: goal.question });
  }

  function dismissSuggest() {
    setGoals([]);
    setLoadingMore(false);
  }

  const isRunning =
    sessionState.phase === "running" ||
    sessionState.phase === "clarifying" ||
    sessionState.phase === "loading" ||
    sessionState.phase === "connecting";

  return {
    sessionState, dataset, cells, goals, loadingMore, isRunning, lastCompletedCellId,
    init, runQuery, runFollowUp, answerClarify, requestSuggest, pickSuggestion, dismissSuggest, loadMoreSuggestions,
  };
}

// ── history builder ────────────────────────────────────────────────────────

function buildHistory(cell: Cell): HistoryMessage[] {
  const history: HistoryMessage[] = [];

  history.push({ role: "user", content: cell.query });

  if (cell.output) {
    if (cell.output.kind === "text") {
      history.push({ role: "assistant", content: [cell.output.explanation, cell.output.result].filter(Boolean).join("\n") });
    } else if (cell.output.kind === "chart") {
      history.push({ role: "assistant", content: [`CHART: ${cell.output.goal}`, cell.output.explanation].filter(Boolean).join("\n") });
    }
  }

  for (const fu of cell.followUps) {
    if (!fu.output) break;
    history.push({ role: "user", content: fu.question });
    if (fu.output.kind === "text") {
      history.push({ role: "assistant", content: [fu.output.explanation, fu.output.result].filter(Boolean).join("\n") });
    } else if (fu.output.kind === "chart") {
      history.push({ role: "assistant", content: [`CHART: ${fu.output.goal}`, fu.output.explanation].filter(Boolean).join("\n") });
    }
  }

  return history;
}
