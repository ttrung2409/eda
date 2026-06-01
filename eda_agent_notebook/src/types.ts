// ── Messages sent from the notebook frontend to eda_agent server ──────────────

export type HistoryMessage = { role: "user" | "assistant"; content: string };

export type ClientMessage =
  | { type: "init"; filePath: string }
  | { type: "query"; text: string; history?: HistoryMessage[]; isFollowUp?: boolean }
  | { type: "clarifyAnswer"; answer: string }
  | { type: "suggest"; persona?: string; existingGoals?: string[] }
  | { type: "suggestPick"; index: number };

// ── Messages sent from eda_agent server to the notebook frontend ──────────────

export type ServerMessage =
  | { type: "status"; message: string }
  | { type: "summary"; name: string; columns: string[]; shape: [number, number] }
  | { type: "clarifyQuestion"; question: string }
  | { type: "chartHtml"; html: string; explanation: string; goal: string }
  | { type: "textResult"; result: string; explanation: string }
  | { type: "goals"; goals: Goal[] }
  | { type: "error"; message: string }
  | { type: "done" };

export type Goal = {
  question: string;
  visualization: string;
  rationale: string;
};

// ── Notebook cell model ───────────────────────────────────────────────────────

export type CellOutput =
  | { kind: "chart"; html: string; explanation: string; goal: string }
  | { kind: "text"; result: string; explanation: string }
  | { kind: "error"; message: string };

export type FollowUpExchange = {
  question: string;
  clarifications: Array<{ question: string; answer: string }>;
  clarifyQuestion: string | null;
  output: CellOutput | null;
  status: string | null;
};

export type Cell = {
  id: string;
  query: string;
  /** Q&A pairs that have already been answered */
  clarifications: Array<{ question: string; answer: string }>;
  /** Suggestions offered when this cell was created via a suggestion pick */
  suggestions?: { goals: Goal[]; pickedIndex: number };
  output: CellOutput | null;
  status: string | null;
  /** pending clarify question waiting for user answer */
  clarifyQuestion: string | null;
  followUps: FollowUpExchange[];
};

export type DatasetInfo = {
  name: string;
  columns: string[];
  shape: [number, number];
};
