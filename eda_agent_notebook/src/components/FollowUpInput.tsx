import { useEffect, useRef, useState } from "react";

const STYLES = {
  container: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
    marginTop: "10px",
    paddingTop: "10px",
    borderTop: "1px dashed #e8e8e8",
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
  onSubmit: (text: string) => void;
  disabled: boolean;
  focusOnMount?: boolean;
};

export function FollowUpInput({ onSubmit, disabled, focusOnMount }: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled && focusOnMount) inputRef.current?.focus();
  }, [disabled, focusOnMount]);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setText("");
  }

  return (
    <div style={STYLES.container}>
      <input
        ref={inputRef}
        style={STYLES.input}
        type="text"
        placeholder="Follow up..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        disabled={disabled}
      />
      <button
        style={STYLES.button}
        onClick={submit}
        disabled={disabled || !text.trim()}
      >
        Ask
      </button>
    </div>
  );
}
