import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { getBridge } from "./pythonBridge.js";
import { buildClarifySystemPrompt } from "../prompts.js";

type Message = { role: "system" | "user" | "assistant"; content: string };

async function chat(messages: Message[]): Promise<string> {
  const { reply } = await getBridge().call<{ reply: string }>("chat", { messages });
  return reply;
}

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

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

export const clarifyStep = createStep({
  id: "clarify",
  inputSchema: z.object({
    summary: z.any(),
    userMessage: z.string(),
  }),
  resumeSchema: z.object({
    answer: z.string(),
  }),
  suspendSchema: z.object({
    question: z.string(),
    messages: z.array(MessageSchema),
    summary: z.any(),
    userMessage: z.string(),
  }),
  outputSchema: z.object({
    kind: z.enum(["chart", "text"]),
    payload: z.string(),
    summary: z.any(),
    userMessage: z.string(),
  }),

  execute: async ({ inputData, resumeData, suspend, suspendData }) => {
    let messages: Message[];
    let summary: unknown;
    let userMessage: string;

    if (!suspendData) {
      summary = inputData.summary;
      userMessage = inputData.userMessage;
      const schema = schemaLines(summary);
      messages = [
        { role: "system", content: buildClarifySystemPrompt(schema) },
        { role: "user", content: userMessage },
      ];
    } else {
      summary = suspendData.summary;
      userMessage = suspendData.userMessage;
      messages = [
        ...suspendData.messages,
        { role: "user", content: resumeData!.answer },
      ];
    }

    const reply = (await chat(messages)).trim();
    const withReply: Message[] = [...messages, { role: "assistant", content: reply }];

    const upper = reply.toUpperCase();
    if (upper.startsWith("CHART:")) {
      return { kind: "chart" as const, payload: reply.slice(reply.indexOf(":") + 1).trim(), summary, userMessage };
    }
    if (upper.startsWith("TEXT:")) {
      return { kind: "text" as const, payload: reply.slice(reply.indexOf(":") + 1).trim(), summary, userMessage };
    }

    // Intent still unclear — keep asking
    return suspend({ question: reply, messages: withReply, summary, userMessage });
  },
});
