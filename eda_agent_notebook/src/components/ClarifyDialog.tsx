import { useState } from "react";

const STYLES = {
  container: {
    marginTop: "8px",
  },
  question: {
    fontSize: "12px",
    color: "#888",
    fontStyle: "italic",
    lineHeight: "1.6",
    marginBottom: "6px",
  },
  aiLabel: {
    fontSize: "11px",
    fontWeight: 700 as const,
    color: "#888",
    letterSpacing: "0.05em",
    marginRight: "6px",
  },
  row: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
  },
  input: {
    flex: 1,
    background: "#f8f8f8",
    border: "1px solid #e0e0e0",
    borderRadius: "6px",
    color: "#1a1a1a",
    padding: "5px 10px",
    fontSize: "12px",
    outline: "none",
    fontFamily: "inherit",
  },
  button: {
    background: "none",
    border: "1px solid #d0d0d0",
    borderRadius: "6px",
    color: "#555",
    padding: "5px 10px",
    fontSize: "12px",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
};

type Props = {
  question: string;
  onAnswer: (answer: string) => void;
};

export function ClarifyDialog({ question, onAnswer }: Props) {
  const [answer, setAnswer] = useState("");

  function submit() {
    if (!answer.trim()) return;
    onAnswer(answer.trim());
    setAnswer("");
  }

  return (
    <div style={STYLES.container}>
      <p style={STYLES.question}>
        <span style={STYLES.aiLabel}>AI:</span>{question}
      </p>
      <div style={STYLES.row}>
        <input
          style={STYLES.input}
          type="text"
          placeholder="Answer..."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        <button style={STYLES.button} onClick={submit}>
          Answer
        </button>
      </div>
    </div>
  );
}
