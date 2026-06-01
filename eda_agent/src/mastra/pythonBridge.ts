import { spawn, type ChildProcess } from "child_process";
import { createInterface } from "readline";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import * as path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// worker.py lives at src/python/worker.py; we are at src/mastra/
const WORKER_PATH = path.resolve(__dirname, "../python/worker.py");

// The eda_agent Python package lives one level up from our project root
// src/mastra → src → eda-mastra → eda_agent (parent project)
const PYTHON_EXTRA_PATH = path.resolve(__dirname, "../../..");

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

export class PythonBridge {
  private proc: ChildProcess | null = null;
  private pending = new Map<string, Pending>();
  private shuttingDown = false;

  private start(): void {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PYTHONPATH: process.env.PYTHONPATH
        ? `${PYTHON_EXTRA_PATH}:${process.env.PYTHONPATH}`
        : PYTHON_EXTRA_PATH,
    };

    this.proc = spawn("python3", [WORKER_PATH], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const rl = createInterface({ input: this.proc.stdout! });
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const msg = JSON.parse(trimmed) as {
          id: string;
          result?: unknown;
          error?: { code: string; message: string };
        };
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) {
          p.reject(new Error(`${msg.error.code}: ${msg.error.message}`));
        } else {
          p.resolve(msg.result);
        }
      } catch {
        // ignore malformed lines
      }
    });

    this.proc.stderr!.on("data", (data: Buffer) => {
      console.error("[python]", data.toString().trimEnd());
    });

    this.proc.on("exit", (code) => {
      this.proc = null;
      if (this.shuttingDown) return;
      console.error(`[python] worker exited unexpectedly (code ${code})`);
      for (const [id, p] of this.pending) {
        p.reject(new Error(`Python worker exited unexpectedly (code ${code})`));
        this.pending.delete(id);
      }
    });
  }

  private ensureRunning(): void {
    if (!this.proc) this.start();
  }

  call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    this.ensureRunning();
    const id = randomUUID();
    const msg = JSON.stringify({ id, method, params }) + "\n";

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.proc!.stdin!.write(msg, (err) => {
        if (err) {
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  shutdown(): void {
    this.shuttingDown = true;
    if (this.proc) {
      this.proc.kill("SIGTERM");
      this.proc = null;
    }
  }
}

// Singleton
let _bridge: PythonBridge | null = null;

export function startBridge(): PythonBridge {
  _bridge = new PythonBridge();
  return _bridge;
}

export function getBridge(): PythonBridge {
  if (!_bridge) throw new Error("Python bridge not started — call startBridge() first");
  return _bridge;
}
