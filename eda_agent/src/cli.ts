import * as readline from "readline";
import * as path from "path";
import { parseArgs } from "util";
import { startBridge, getBridge } from "./mastra/pythonBridge.js";
import { edaWorkflow } from "./mastra/index.js";

// ── CLI args ──────────────────────────────────────────────────────────────────
const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    provider: { type: "string", default: "ollama" },
    model: { type: "string" },
    "api-key": { type: "string" },
    "n-goals": { type: "string", default: "5" },
  },
  allowPositionals: true,
});

const filePath = positionals[0];
if (!filePath) {
  console.error("Usage: tsx src/cli.ts <file.csv> [--provider ollama|gemini] [--model <name>] [--api-key <key>] [--n-goals <n>]");
  process.exit(1);
}

const provider = (values.provider as string) === "gemini" ? "gemini" : "ollama";
const nGoals = parseInt(values["n-goals"] as string, 10) || 5;

let model: string;
let apiKey: string | undefined;

if (provider === "gemini") {
  apiKey = (values["api-key"] as string | undefined) ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Error: Gemini requires an API key. Pass --api-key or set GEMINI_API_KEY.");
    process.exit(1);
  }
  model = (values.model as string | undefined) ?? "gemini-2.5-flash-lite";
} else {
  model = (values.model as string | undefined) ?? "llama3.1:8b";
}

// ── readline ──────────────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
let rlClosed = false;
rl.on("close", () => { rlClosed = true; });

function prompt(text: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (rlClosed) { resolve(null); return; }
    process.stdout.write(text);
    const onLine = (line: string) => { rl.removeListener("close", onClose); resolve(line.trim() || null); };
    const onClose = () => { rl.removeListener("line", onLine); resolve(null); };
    rl.once("line", onLine);
    rl.once("close", onClose);
  });
}

const EXIT_COMMANDS = new Set(["quit", "exit", "q"]);

// ── suggest flow ──────────────────────────────────────────────────────────────
async function handleSuggest(summary: unknown, line: string): Promise<void> {
  const bridge = getBridge();
  const personaText = line.slice("/suggest".length).trim();

  if (personaText) {
    console.log(`Generating suggestions for: ${personaText}...`);
  } else {
    console.log("Generating suggestions...");
  }

  let goals: Array<{ question: string; visualization: string; rationale: string }>;
  try {
    const res = await bridge.call<{ goals: typeof goals }>("goals", {
      summary,
      n: nGoals,
      persona: personaText,
    });
    goals = res.goals;
  } catch (e) {
    console.error(`Could not generate goals: ${e}`);
    return;
  }

  while (true) {
    console.log();
    goals.forEach((g, i) => console.log(`  ${i + 1}. ${g.question}`));

    const pick = await prompt("\nPick a number, 'more' for more suggestions, or 'back' to restart: ");
    if (pick === null || EXIT_COMMANDS.has(pick.toLowerCase())) { process.exit(0); }
    if (pick.toLowerCase() === "back") return;

    if (pick.toLowerCase() === "more") {
      console.log("Generating more suggestions...");
      try {
        const extra = await bridge.call<{ goals: typeof goals }>("goals", {
          summary,
          n: nGoals,
          persona: personaText,
        });
        goals = [...goals, ...extra.goals];
      } catch (e) {
        console.error(`Could not generate goals: ${e}`);
      }
      continue;
    }

    const idx = parseInt(pick, 10);
    if (!isNaN(idx) && idx >= 1 && idx <= goals.length) {
      const goal = goals[idx - 1].question;
      await runWorkflow(path.resolve(filePath), goal);
      return;
    }

    console.log(`  Please enter a number between 1 and ${goals.length}.`);
  }
}

// ── single workflow runner ────────────────────────────────────────────────────
async function runWorkflow(resolvedPath: string, userMessage: string): Promise<void> {
  const run = await edaWorkflow.createRun();
  let result = await run.start({ inputData: { filePath: resolvedPath, userMessage } });

  while (result.status === "suspended") {
    // suspendPayload is keyed by step ID — unwrap the first suspended step's payload
    const stepPayloads = result.suspendPayload as Record<string, Record<string, unknown>>;
    const payload = Object.values(stepPayloads)[0] ?? {};

    if ("question" in payload) {
      const question = payload.question as string;
      console.log(`\n${question}`);
      const answer = await prompt("> ");
      if (answer === null || EXIT_COMMANDS.has(answer.toLowerCase()) || ["back", "done"].includes(answer.toLowerCase())) return;
      result = await run.resume({ resumeData: { answer } });
    } else {
      break;
    }
  }

  if (result.status === "success") {
    // result.result is keyed by step ID — unwrap the first step's output
    const stepOutputs = result.result as Record<string, Record<string, unknown>>;
    const output = Object.values(stepOutputs ?? {})[0] ?? {};
    if ("code" in output) {
      // Chart: render via matplotlib window
      await getBridge().call("showChart", { code: output.code });
    } else if ("result" in output) {
      console.log(`\n${output.result}`);
    }
  } else if (result.status === "failed") {
    console.error(`Workflow error: ${JSON.stringify((result as { error?: unknown }).error)}`);
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const bridge = startBridge();

  process.on("SIGINT", () => {
    console.log("\nBye.");
    bridge.shutdown();
    process.exit(0);
  });

  console.log(`Loading ${path.resolve(filePath)}...`);
  try {
    await bridge.call("init", { provider, model, ...(apiKey ? { apiKey } : {}) });
  } catch (e) {
    console.error(`Failed to initialise Python worker: ${e}`);
    bridge.shutdown();
    process.exit(1);
  }

  let schema: Array<{ column: string; dtype: string; samples: string[] }>;
  let shape: [number, number];
  let summary: unknown;

  try {
    const res = await bridge.call<{ schema: typeof schema; shape: [number, number] }>(
      "loadData", { filePath: path.resolve(filePath) }
    );
    schema = res.schema;
    shape = res.shape;
  } catch (e) {
    console.error(`Failed to load file: ${e}`);
    bridge.shutdown();
    process.exit(1);
  }
  console.log(`Loaded: ${shape[0]} rows × ${shape[1]} columns\n`);

  console.log("Summarising dataset (this may take a moment)...");
  try {
    const res = await bridge.call<{ summary: unknown }>("summarize", {});
    summary = res.summary;
  } catch (e) {
    console.error(`Failed to summarise: ${e}`);
    bridge.shutdown();
    process.exit(1);
  }

  const rawName = (summary as Record<string, unknown>)?.name;
  const name = (rawName && String(rawName).trim()) ? String(rawName) : "(unnamed)";
  const cols = schema.map((f) => f.column).join(", ");
  console.log(`\nDataset: ${name}`);
  console.log(`Columns: ${cols}\n`);
  console.log("Type '/suggest [intent]' for recommendations, or 'quit' to exit.\n");

  // Main REPL loop
  while (true) {
    const line = await prompt("\nWhat would you like to explore? (or '/suggest [intent]' for ideas): ");
    if (line === null || EXIT_COMMANDS.has(line.toLowerCase())) break;

    const lower = line.toLowerCase();

    if (lower === "/suggest" || lower.startsWith("/suggest ")) {
      await handleSuggest(summary, line);
    } else {
      await runWorkflow(path.resolve(filePath), line);
    }
  }

  bridge.shutdown();
  console.log("Bye.");
  rl.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
