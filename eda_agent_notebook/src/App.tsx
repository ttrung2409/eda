import { useRef, useState, useEffect } from "react";
import { FileLoader } from "./components/FileLoader";
import { NotebookCell } from "./components/NotebookCell";
import { useAgentSession } from "./hooks/useAgentSession";
import type { Goal } from "./types";

const STYLES = {
  app: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    background: "#f5f5f5",
  },
  main: {
    flex: 1,
    maxWidth: "900px",
    margin: "0 auto",
    width: "100%",
    padding: "0 24px 80px",
  },
  datasetHeader: {
    padding: "16px 0 4px",
    borderBottom: "1px solid #e0e0e0",
    marginBottom: "8px",
  },
  datasetName: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1a1a1a",
    marginBottom: "4px",
  },
  datasetMeta: {
    fontSize: "12px",
    color: "#757575",
    fontFamily: "monospace",
  },
  statusBanner: {
    margin: "16px 0",
    padding: "10px 16px",
    background: "#e8f0fe",
    border: "1px solid #c5d8fc",
    borderRadius: "6px",
    fontSize: "13px",
    color: "#1a56b0",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  inputArea: {
    marginTop: "24px",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    background: "#ffffff",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  inputRow: {
    display: "flex",
    gap: "8px",
    padding: "12px",
    alignItems: "flex-start",
  },
  textarea: {
    flex: 1,
    background: "#f8f8f8",
    border: "1px solid #e0e0e0",
    borderRadius: "6px",
    color: "#1a1a1a",
    padding: "8px 12px",
    fontSize: "14px",
    resize: "none" as const,
    outline: "none",
    fontFamily: "inherit",
    lineHeight: "1.5",
    minHeight: "40px",
    maxHeight: "120px",
  },
  runButton: {
    background: "#1a73e8",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    padding: "8px 18px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    alignSelf: "flex-end",
  },
  runButtonDisabled: {
    background: "#e0e0e0",
    border: "none",
    borderRadius: "6px",
    color: "#aaa",
    padding: "8px 18px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "not-allowed",
    whiteSpace: "nowrap" as const,
    alignSelf: "flex-end",
  },
  goalsPanel: {
    marginTop: "12px",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    background: "#ffffff",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  goalsPanelHeader: {
    padding: "10px 16px",
    background: "#f8f8f8",
    borderBottom: "1px solid #e0e0e0",
    fontSize: "12px",
    fontWeight: 600,
    color: "#757575",
    display: "flex",
    justifyContent: "space-between",
  },
  goalItem: {
    padding: "10px 16px",
    borderBottom: "1px solid #f0f0f0",
    cursor: "pointer",
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
  },
  goalIndex: {
    fontSize: "12px",
    color: "#1a73e8",
    fontFamily: "monospace",
    flexShrink: 0,
    paddingTop: "1px",
  },
  goalQuestion: {
    fontSize: "13px",
    color: "#1a1a1a",
    lineHeight: "1.5",
  },
  errorBanner: {
    margin: "16px 0",
    padding: "12px 16px",
    background: "#fef0f0",
    border: "1px solid #f5c6c6",
    borderRadius: "6px",
    fontSize: "13px",
    color: "#d93025",
  },
};

export function App() {
  const { sessionState, dataset, cells, goals, loadingMore, isRunning, lastCompletedCellId, init, runQuery, runFollowUp, answerClarify, requestSuggest, pickSuggestion, dismissSuggest, loadMoreSuggestions } =
    useAgentSession();

  const [queryText, setQueryText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when cells change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [cells]);


  const canRun = !isRunning && sessionState.phase === "ready" && queryText.trim().length > 0;
  const showGoals = goals.length > 0 || loadingMore;

  function handleRun() {
    if (!canRun) return;
    const text = queryText.trim();
    setQueryText("");
    const lower = text.toLowerCase();
    if (lower === "/suggest" || lower.startsWith("/suggest ")) {
      const persona = text.slice("/suggest".length).trim() || undefined;
      requestSuggest(persona);
    } else {
      runQuery(text);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleRun();
    }
  }

  const activeClarifyingCell = cells.find(
    (c) => c.clarifyQuestion !== null || c.followUps.some((f) => f.clarifyQuestion !== null)
  ) ?? null;

  return (
    <div style={STYLES.app}>
      <FileLoader onLoad={init} disabled={isRunning} />

      <div style={STYLES.main}>
        {/* Status / loading banner */}
        {(sessionState.phase === "connecting" || sessionState.phase === "loading") && (
          <div style={STYLES.statusBanner}>
            <span>⏳</span>
            <span>{sessionState.phase === "connecting" ? "Connecting..." : sessionState.status}</span>
          </div>
        )}

        {/* Error banner */}
        {sessionState.phase === "error" && (
          <div style={STYLES.errorBanner}>⚠ {sessionState.message}</div>
        )}

        {/* Dataset header */}
        {dataset && (
          <div style={STYLES.datasetHeader}>
            <div style={STYLES.datasetName}>{dataset.name}</div>
            <div style={STYLES.datasetMeta}>
              {dataset.shape[0].toLocaleString()} rows × {dataset.shape[1]} columns &nbsp;·&nbsp;{" "}
              {dataset.columns.join(", ")}
            </div>
          </div>
        )}

        {/* Notebook cells */}
        {cells.map((cell, i) => (
          <NotebookCell
            key={cell.id}
            cell={cell}
            index={i + 1}
            onClarifyAnswer={activeClarifyingCell?.id === cell.id ? answerClarify : () => {}}
            onFollowUp={runFollowUp}
            isRunning={isRunning}
            isLastFollowUpCell={cell.id === lastCompletedCellId}
          />
        ))}

        {/* Active input cell — only shown when session is ready or running (not loading/connecting) */}
        {(sessionState.phase === "ready" ||
          sessionState.phase === "running" ||
          sessionState.phase === "clarifying") && (
          <div style={STYLES.inputArea}>
            <div style={STYLES.inputRow}>
              <textarea
                autoFocus
                style={STYLES.textarea}
                rows={1}
                placeholder={isRunning ? "Waiting for response..." : `Ask anything about the dataset, or type "/suggest [intent]" for ideas`}
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isRunning}
              />
              <button
                style={canRun ? STYLES.runButton : STYLES.runButtonDisabled}
                onClick={handleRun}
                disabled={!canRun}
              >
                ▶ Run
              </button>
            </div>
          </div>
        )}

        {/* Suggest goals panel */}
        {showGoals && (
          <GoalsPanel
            goals={goals}
            loadingMore={loadingMore}
            onPick={(i) => {
              setQueryText("");
              pickSuggestion(i);
            }}
            onDismiss={dismissSuggest}
            onMore={loadMoreSuggestions}
          />
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── GoalsPanel ─────────────────────────────────────────────────────────────────

function GoalsPanel({
  goals,
  loadingMore,
  onPick,
  onDismiss,
  onMore,
}: {
  goals: Goal[];
  loadingMore: boolean;
  onPick: (index: number) => void;
  onDismiss: () => void;
  onMore: () => void;
}) {
  return (
    <div style={STYLES.goalsPanel}>
      <div style={STYLES.goalsPanelHeader}>
        <span>Suggested explorations — click to run</span>
        <button
          onClick={onDismiss}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "13px", padding: "0 2px" }}
        >
          ✕
        </button>
      </div>
      {goals.map((g, i) => (
        <div
          key={i}
          style={STYLES.goalItem}
          onClick={() => onPick(i + 1)}
          onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#f0f6ff")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
        >
          <span style={STYLES.goalIndex}>{i + 1}.</span>
          <span style={STYLES.goalQuestion}>{g.question}</span>
        </div>
      ))}
      <div
        style={{ ...STYLES.goalItem, color: loadingMore ? "#aaa" : "#1a73e8", fontStyle: "italic", cursor: loadingMore ? "default" : "pointer" }}
        onClick={loadingMore ? undefined : onMore}
        onMouseEnter={(e) => { if (!loadingMore) (e.currentTarget as HTMLDivElement).style.background = "#f0f6ff"; }}
        onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
      >
        <span style={STYLES.goalIndex}>{loadingMore ? "…" : "+"}</span>
        <span style={{ fontSize: "13px" }}>{loadingMore ? "Loading more suggestions..." : "More suggestions..."}</span>
      </div>
    </div>
  );
}
