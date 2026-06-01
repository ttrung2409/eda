import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { PythonBridge } from "./mastra/pythonBridge.js";
import { buildClarifySystemPrompt, buildFollowUpSystemPrompt } from "./prompts.js";
import { parseArgs } from "util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── CLI args ──────────────────────────────────────────────────────────────────
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    port: { type: "string", default: "3001" },
  },
});
const PORT = parseInt(values.port as string, 10) || 3001;

// ── Types ─────────────────────────────────────────────────────────────────────

type HistoryMessage = { role: "user" | "assistant"; content: string };

type ClientMessage =
  | { type: "init"; filePath: string }
  | { type: "query"; text: string; history?: HistoryMessage[]; isFollowUp?: boolean }
  | { type: "clarifyAnswer"; answer: string }
  | { type: "suggest"; persona?: string; existingGoals?: string[] }
  | { type: "suggestPick"; index: number };

type ServerMessage =
  | { type: "status"; message: string }
  | { type: "summary"; name: string; columns: string[]; shape: [number, number] }
  | { type: "clarifyQuestion"; question: string }
  | { type: "chartHtml"; html: string; explanation: string; goal: string }
  | { type: "textResult"; result: string; explanation: string }
  | { type: "goals"; goals: Array<{ question: string; visualization: string; rationale: string }> }
  | { type: "error"; message: string }
  | { type: "done" };

// ── Helpers ───────────────────────────────────────────────────────────────────

type Message = { role: "system" | "user" | "assistant"; content: string };

function extractTextPayload(rest: string): { explanation: string; code: string } {
  const [before, after] = rest.split(/\n<<<PYTHON>>>\n/);
  const explanation = (before ?? "").trim();
  const code = (after ?? "").replace(/^```[\w]*\r?\n?/m, "").replace(/```\s*$/m, "").replace(/\n?<<<PYTHON>>>\s*$/m, "").trim();
  return { explanation, code };
}

function schemaLines(summary: unknown): string {
  const s = summary as Record<string, unknown> | null;
  const fields = (s?.fields as unknown[]) ?? [];
  return (fields as Record<string, unknown>[])
    .map((f) => {
      const col = (f.column as string) ?? "";
      const props = (f.properties as Record<string, unknown>) ?? {};
      const dtype = (props.dtype as string) ?? "";
      const samples = (props.samples as unknown[]) ?? [];
      return `  - ${col} (${dtype}), e.g. ${JSON.stringify(samples)}`;
    })
    .join("\n");
}

// ── Session ───────────────────────────────────────────────────────────────────

class Session {
  private bridge: PythonBridge;
  private filePath: string | null = null;
  private summary: unknown = null;
  private clarifyResolve: ((answer: string) => void) | null = null;
  private goalsList: Array<{ question: string; visualization: string; rationale: string }> = [];

  constructor(private ws: WebSocket) {
    this.bridge = new PythonBridge();
  }

  send(msg: ServerMessage): void {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  async handleMessage(raw: string): Promise<void> {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      this.send({ type: "error", message: "Invalid JSON" });
      return;
    }

    try {
      switch (msg.type) {
        case "init":       await this.handleInit(msg); break;
        case "query":      await this.handleQuery(msg.text, msg.history ?? [], msg.isFollowUp ?? false); break;
        case "clarifyAnswer": this.handleClarifyAnswer(msg.answer); break;
        case "suggest":    await this.handleSuggest(msg.persona, msg.existingGoals ?? []); break;
        case "suggestPick": await this.handleSuggestPick(msg.index); break;
        default:
          this.send({ type: "error", message: `Unknown message type` });
      }
    } catch (e) {
      console.error("[session error]", e);
      this.send({ type: "error", message: String(e) });
    }
  }

  // ── init ──────────────────────────────────────────────────────────────────

  private async handleInit(msg: Extract<ClientMessage, { type: "init" }>): Promise<void> {
    const { filePath } = msg;
    this.filePath = path.resolve(filePath);

    const provider = process.env.LLM_PROVIDER?.toLowerCase();
    if (!provider) throw new Error("LLM_PROVIDER environment variable is not set");
    let initParams: Record<string, string>;

    if (provider === "ollama") {
      const model = process.env.OLLAMA_MODEL;
      if (!model) throw new Error("OLLAMA_MODEL environment variable is not set");
      initParams = { provider: "ollama", model };
    } else {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not set");
      const model = process.env.GEMINI_MODEL;
      if (!model) throw new Error("GEMINI_MODEL environment variable is not set");
      initParams = { provider: "gemini", model, apiKey };
    }

    this.send({ type: "status", message: "Initialising..." });
    await this.bridge.call("init", initParams);

    this.send({ type: "status", message: `Loading ${path.basename(filePath)}...` });
    const { schema, shape } = await this.bridge.call<{
      schema: Array<{ column: string; dtype: string; samples: string[] }>;
      shape: [number, number];
    }>("loadData", { filePath: this.filePath });

    this.send({ type: "status", message: "Summarising dataset (this may take a moment)..." });
    const { summary } = await this.bridge.call<{ summary: unknown }>("summarize", {});
    this.summary = summary;

    const columns = schema.map((f) => f.column);

    this.send({ type: "summary", name: "Dataset", columns, shape });
  }

  // ── query ─────────────────────────────────────────────────────────────────

  private async handleQuery(userMessage: string, history: HistoryMessage[] = [], isFollowUp = false): Promise<void> {
    if (!this.summary) {
      this.send({ type: "error", message: "No dataset loaded. Send an init message first." });
      return;
    }

    const schema = schemaLines(this.summary);
    const systemPrompt = isFollowUp
      ? buildFollowUpSystemPrompt(schema)
      : buildClarifySystemPrompt(schema);
    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage },
    ];

    await this.runClarifyLoop(messages, isFollowUp);
    this.send({ type: "done" });
  }

  // ── clarify loop ──────────────────────────────────────────────────────────

  private async runClarifyLoop(messages: Message[], isFollowUp = false): Promise<void> {
    const MAX_ROUNDS = 4;
    let rounds = 0;

    while (rounds < MAX_ROUNDS) {
      rounds++;
      console.log("\n[llm] user:", messages[messages.length - 1].content);
      const { reply } = await this.bridge.call<{ reply: string }>("chat", { messages });
      console.log("[llm] reply:", reply);
      const withReply: Message[] = [...messages, { role: "assistant", content: reply }];

      const upper = reply.toUpperCase();
      if (upper.startsWith("CHART:")) {
        const rest = reply.slice(reply.indexOf(":") + 1);
        const nl = rest.indexOf("\n");
        const goal = (nl >= 0 ? rest.slice(0, nl) : rest).trim();
        const explanation = nl >= 0
          ? rest.slice(nl + 1).split(/<<<PYTHON>>>|```/)[0].split("\n")[0].trim()
          : "";
        await this.runVisualize(goal, explanation);
        return;
      }
      if (upper.startsWith("TEXT:")) {
        const { explanation, code } = extractTextPayload(reply.slice(reply.indexOf(":") + 1));
        if (code) {
          await this.runExecCode(code, explanation);
        } else {
          this.send({ type: "textResult", result: explanation, explanation: "" });
        }
        return;
      }

      // In follow-up mode, any non-CHART/CODE reply is the final plain-text answer
      if (isFollowUp) {
        this.send({ type: "textResult", result: reply, explanation: "" });
        return;
      }

      // Clarify question — suspend until answer arrives
      this.send({ type: "clarifyQuestion", question: reply });
      const answer = await this.waitForClarifyAnswer();
      messages = [...withReply, { role: "user", content: answer }];
    }

    this.send({ type: "error", message: "Could not determine intent after several questions." });
  }

  private waitForClarifyAnswer(): Promise<string> {
    return new Promise((resolve) => {
      this.clarifyResolve = resolve;
    });
  }

  private handleClarifyAnswer(answer: string): void {
    if (this.clarifyResolve) {
      const resolve = this.clarifyResolve;
      this.clarifyResolve = null;
      resolve(answer);
    }
  }

  // ── visualize ─────────────────────────────────────────────────────────────

  private async runVisualize(goal: string, explanation: string): Promise<void> {
    this.send({ type: "status", message: "Generating chart..." });
    const lidaGoal = explanation ? `${goal} ${explanation}` : goal;
    const { code } = await this.bridge.call<{ code: string }>("visualize", {
      summary: this.summary,
      goal: lidaGoal,
    });

    this.send({ type: "status", message: "Rendering chart..." });
    const { html } = await this.bridge.call<{ html: string }>("showChartHtml", { code });
    this.send({ type: "chartHtml", html, explanation, goal });
  }

  // ── exec code ─────────────────────────────────────────────────────────────

  private async runExecCode(code: string, explanation: string): Promise<void> {
    this.send({ type: "status", message: "Running code..." });
    const { result } = await this.bridge.call<{ result: string }>("execCode", { code });
    this.send({ type: "textResult", result, explanation });
  }

  // ── suggest ───────────────────────────────────────────────────────────────

  private async handleSuggest(persona?: string, existingGoals: string[] = []): Promise<void> {
    if (!this.summary) {
      this.send({ type: "error", message: "No dataset loaded. Send an init message first." });
      return;
    }
    this.send({ type: "status", message: "Generating suggestions..." });
    const { goals } = await this.bridge.call<{
      goals: Array<{ question: string; visualization: string; rationale: string }>;
    }>("goals", { summary: this.summary, n: 5, persona: persona ?? "", existingGoals });
    this.goalsList = goals;
    this.send({ type: "goals", goals });
  }

  private async handleSuggestPick(index: number): Promise<void> {
    const goal = this.goalsList[index - 1];
    if (!goal) {
      this.send({ type: "error", message: `No goal at index ${index}` });
      return;
    }
    await this.handleQuery(goal.question);
  }

  // ── cleanup ───────────────────────────────────────────────────────────────

  shutdown(): void {
    this.bridge.shutdown();
  }
}

// ── Upload handler ────────────────────────────────────────────────────────────

function handleUpload(req: IncomingMessage, res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }

  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    try {
      const data = Buffer.concat(chunks);
      const filePath = path.join(os.tmpdir(), `eda_upload_${randomUUID()}.csv`);
      fs.writeFileSync(filePath, data);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ filePath }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(e) }));
    }
  });
  req.on("error", () => {
    res.writeHead(500).end();
  });
}

// ── Server ────────────────────────────────────────────────────────────────────

const httpServer = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.url === "/health") {
    res.writeHead(200).end("ok");
  } else if (req.url === "/upload") {
    handleUpload(req, res);
  } else {
    res.writeHead(404).end();
  }
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  console.log("[server] client connected");
  const session = new Session(ws);

  ws.on("message", (raw) => {
    session.handleMessage(raw.toString()).catch((e) => {
      console.error("[server] unhandled error:", e);
    });
  });

  ws.on("close", () => {
    console.log("[server] client disconnected");
    session.shutdown();
  });

  ws.on("error", (e) => {
    console.error("[server] ws error:", e);
    session.shutdown();
  });
});

httpServer.listen(PORT, () => {
  console.log(`EDA Agent server listening on ws://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
