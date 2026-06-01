import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { getBridge } from "./pythonBridge.js";

export const textBasedResponseStep = createStep({
  id: "answer-query",
  inputSchema: z.object({
    kind: z.enum(["chart", "text"]),
    payload: z.string(),
    summary: z.any(),
    userMessage: z.string(),
  }),
  outputSchema: z.object({ result: z.string() }),

  execute: async ({ inputData }) => {
    const code = inputData.payload
      .replace(/^```[\w]*\r?\n?/m, "")
      .replace(/```\s*$/m, "")
      .trim();
    const { result } = await getBridge().call<{ result: string }>("execCode", { code });
    return { result };
  },
});
