import { useEffect, useRef, useState } from "react";
import type { CellOutput as CellOutputType } from "../types";

const STYLES = {
  aiLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#888",
    letterSpacing: "0.05em",
    marginRight: "6px",
  },
  explanation: {
    fontSize: "12px",
    color: "#888",
    fontStyle: "italic",
    lineHeight: "1.5",
    marginBottom: "10px",
  },
  chartContainer: {
    marginTop: "12px",
    overflow: "hidden",
  },
  textContainer: {
    marginTop: "12px",
    padding: "12px 16px",
    background: "#f8f8f8",
    border: "1px solid #e8e8e8",
    borderRadius: "6px",
    fontFamily: "monospace",
    fontSize: "13px",
    color: "#1a1a1a",
    whiteSpace: "pre-wrap" as const,
    lineHeight: "1.6",
  },
  errorContainer: {
    marginTop: "12px",
    padding: "12px 16px",
    background: "#fef0f0",
    border: "1px solid #f5c6c6",
    borderRadius: "6px",
    fontFamily: "monospace",
    fontSize: "13px",
    color: "#d93025",
    whiteSpace: "pre-wrap" as const,
  },
};

type Props = {
  output: CellOutputType;
  hideExplanation?: boolean;
  plain?: boolean;
};

function ChartFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(420);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      // Only respond to messages from our specific iframe
      if (e.source !== ref.current?.contentWindow) return;
      if (e.data?.type === "chartHeight" && typeof e.data.height === "number") {
        setHeight(e.data.height);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={ref}
      srcDoc={html}
      style={{ width: "100%", height, border: "none", display: "block" }}
      sandbox="allow-scripts"
    />
  );
}

export function CellOutput({ output, hideExplanation, plain }: Props) {
  if (output.kind === "chart") {
    return (
      <div style={STYLES.chartContainer}>
        {!hideExplanation && output.explanation && (
          <div style={STYLES.explanation}>
            <span style={STYLES.aiLabel}>AI:</span>{output.explanation}
          </div>
        )}
        <ChartFrame html={output.html} />
      </div>
    );
  }

  if (output.kind === "text") {
    return (
      <div>
        {!hideExplanation && output.explanation && (
          <div style={STYLES.explanation}>
            <span style={STYLES.aiLabel}>AI:</span>{output.explanation}
          </div>
        )}
        {plain ? (
          <p style={{ fontSize: "13px", color: "#333", lineHeight: "1.6", margin: 0, whiteSpace: "pre-wrap" }}>{output.result}</p>
        ) : (
          <div style={STYLES.textContainer}>{output.result}</div>
        )}
      </div>
    );
  }

  if (output.kind === "error") {
    return <div style={STYLES.errorContainer}>⚠ {output.message}</div>;
  }

  return null;
}
