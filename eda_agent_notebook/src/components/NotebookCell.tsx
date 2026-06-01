import { useState } from "react";
import type { Cell } from "../types";
import { CellOutput } from "./CellOutput";
import { ClarifyDialog } from "./ClarifyDialog";
import { FollowUpInput } from "./FollowUpInput";

const STYLES = {
  cell: {
    margin: "16px 0",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    background: "#ffffff",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "10px 16px",
    borderBottom: "1px solid #e8e8e8",
    background: "#f8f8f8",
  },
  badge: {
    flexShrink: 0,
    fontSize: "11px",
    fontWeight: 700,
    color: "#1a73e8",
    fontFamily: "monospace",
    paddingTop: "2px",
    userSelect: "none" as const,
  },
  headerContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  },
  query: {
    fontSize: "14px",
    color: "#1a1a1a",
    lineHeight: "1.5",
  },
  clarifyRow: {
    fontSize: "12px",
    lineHeight: "1.4",
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
  },
  clarifyQ: {
    color: "#888",
  },
  clarifyA: {
    color: "#1a73e8",
    fontWeight: 500,
    paddingLeft: "12px",
  },
  suggestionsToggle: {
    fontSize: "12px",
    color: "#aaa",
    cursor: "pointer",
    userSelect: "none" as const,
    lineHeight: "1.4",
  },
  suggestionsList: {
    marginTop: "2px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
  },
  suggestionItem: {
    fontSize: "12px",
    color: "#aaa",
    lineHeight: "1.4",
  },
  suggestionItemPicked: {
    fontSize: "12px",
    color: "#1a73e8",
    fontWeight: 500,
    lineHeight: "1.4",
  },
  body: {
    padding: "12px 16px",
  },
  followUpThread: {
    marginTop: "12px",
    paddingTop: "12px",
    borderTop: "1px solid #f0f0f0",
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },
  followUpPrefix: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.05em",
  },
  followUpUserPrefix: {
    color: "#1a73e8",
  },
  followUpAiPrefix: {
    color: "#888",
  },
  aiText: {
    fontSize: "12px",
    color: "#888",
    fontStyle: "italic",
    lineHeight: "1.6",
  },
  followUpQ: {
    fontSize: "13px",
    color: "#333",
    marginBottom: "4px",
  },
  spinner: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    color: "#757575",
    marginTop: "8px",
  },
  spinnerDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#1a73e8",
    animation: "pulse 1.2s ease-in-out infinite",
  },
};

// Inject keyframes once
if (typeof document !== "undefined") {
  const styleEl = document.getElementById("nb-styles");
  if (!styleEl) {
    const s = document.createElement("style");
    s.id = "nb-styles";
    s.textContent = `@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`;
    document.head.appendChild(s);
  }
}

type Props = {
  cell: Cell;
  index: number;
  onClarifyAnswer: (answer: string) => void;
  onFollowUp: (cellId: string, text: string) => void;
  isRunning: boolean;
  isLastFollowUpCell: boolean;
};

export function NotebookCell({ cell, index, onClarifyAnswer, onFollowUp, isRunning, isLastFollowUpCell }: Props) {
  const cellIsRunning = cell.output === null && cell.clarifyQuestion === null;
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  return (
    <div style={STYLES.cell}>
      <div style={STYLES.header}>
        <span style={STYLES.badge}>In [{index}]:</span>
        <div style={STYLES.headerContent}>
          <span style={STYLES.query}>{cell.query}</span>
          {cell.suggestions && (
            <>
              <span
                style={STYLES.suggestionsToggle}
                onClick={() => setSuggestionsOpen((v) => !v)}
              >
                {suggestionsOpen ? "▾" : "▸"} {cell.suggestions.goals.length} suggestions
              </span>
              {suggestionsOpen && (
                <div style={STYLES.suggestionsList}>
                  {cell.suggestions.goals.map((g, i) => (
                    <span
                      key={i}
                      style={i === cell.suggestions!.pickedIndex ? STYLES.suggestionItemPicked : STYLES.suggestionItem}
                    >
                      {i === cell.suggestions!.pickedIndex ? "→ " : "   "}{i + 1}. {g.question}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div style={STYLES.body}>
        {/* Clarification conversation */}
        {cell.clarifications.map((c, i) => (
          <div key={i} style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <div>
              <span style={{ ...STYLES.followUpPrefix, ...STYLES.followUpAiPrefix }}>AI: </span>
              <span style={STYLES.aiText}>{c.question}</span>
            </div>
            <div>
              <span style={{ ...STYLES.followUpPrefix, ...STYLES.followUpUserPrefix }}>User: </span>
              <span style={{ fontSize: "12px", color: "#333" }}>{c.answer}</span>
            </div>
          </div>
        ))}

        {/* Active clarify question */}
        {cell.clarifyQuestion && (
          <ClarifyDialog question={cell.clarifyQuestion} onAnswer={onClarifyAnswer} />
        )}

        {/* Final output */}
        {cell.output && <CellOutput output={cell.output} />}

        {/* Follow-up thread */}
        {cell.followUps.length > 0 && (
          <div style={STYLES.followUpThread}>
            {cell.followUps.map((fu, i) => (
              <div key={i}>
                <div style={STYLES.followUpQ}>
                  <span style={{ ...STYLES.followUpPrefix, ...STYLES.followUpUserPrefix }}>User: </span>{fu.question}
                </div>
                {fu.clarifications.map((c, j) => (
                  <div key={j} style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                    <div>
                      <span style={{ ...STYLES.followUpPrefix, ...STYLES.followUpAiPrefix }}>AI: </span>
                      <span style={STYLES.aiText}>{c.question}</span>
                    </div>
                    <div>
                      <span style={{ ...STYLES.followUpPrefix, ...STYLES.followUpUserPrefix }}>User: </span>
                      <span style={{ fontSize: "13px", color: "#333" }}>{c.answer}</span>
                    </div>
                  </div>
                ))}
                {fu.clarifyQuestion && (
                  <ClarifyDialog question={fu.clarifyQuestion} onAnswer={onClarifyAnswer} />
                )}
                {fu.output && (
                  <div style={{ marginTop: "8px" }}>
                    {fu.output.kind === "text" ? (
                      <div>
                        <div>
                          <span style={{ ...STYLES.followUpPrefix, ...STYLES.followUpAiPrefix }}>AI: </span>
                          {fu.output.explanation && <span style={STYLES.aiText}>{fu.output.explanation}</span>}
                          {!fu.output.explanation && fu.output.result && <span style={{ ...STYLES.aiText, whiteSpace: "pre-wrap" }}>{fu.output.result}</span>}
                        </div>
                        {fu.output.explanation && fu.output.result && (
                          <pre style={{ margin: "6px 0 0", padding: "8px 12px", background: "#f4f4f4", border: "1px solid #e0e0e0", borderRadius: "6px", fontSize: "12px", color: "#1a1a1a", whiteSpace: "pre-wrap", lineHeight: "1.6", overflowX: "auto" }}>{fu.output.result}</pre>
                        )}
                      </div>
                    ) : (
                      <>
                        <div style={{ marginBottom: "4px" }}>
                          <span style={{ ...STYLES.followUpPrefix, ...STYLES.followUpAiPrefix }}>AI:</span>
                          {"explanation" in fu.output && fu.output.explanation && (
                            <span style={{ ...STYLES.aiText, marginLeft: "6px" }}>{fu.output.explanation}</span>
                          )}
                        </div>
                        <CellOutput output={fu.output} hideExplanation plain />
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            {/* Thinking indicator pinned to the bottom of the thread */}
            {cell.followUps.some((fu) => fu.status && !fu.output) && (
              <div style={STYLES.spinner}>
                <span style={{ ...STYLES.followUpPrefix, ...STYLES.followUpAiPrefix }}>AI:</span>
                <span>{cell.followUps.find((fu) => fu.status && !fu.output)!.status}</span>
              </div>
            )}
          </div>
        )}

        {/* Running state — shown at the bottom of the conversation */}
        {cellIsRunning && cell.status && (
          <div style={STYLES.spinner}>
            <span style={{ ...STYLES.followUpPrefix, ...STYLES.followUpAiPrefix }}>AI:</span>
            <span>{cell.status}</span>
          </div>
        )}

        {/* Follow-up input — shown when all exchanges are complete */}
        {cell.output && cell.followUps.every((f) => f.output !== null) && (
          <FollowUpInput
            onSubmit={(text) => onFollowUp(cell.id, text)}
            disabled={isRunning}
            focusOnMount={isLastFollowUpCell}
          />
        )}
      </div>
    </div>
  );
}
