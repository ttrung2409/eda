import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { getBridge } from "./pythonBridge.js";

export const summarizeStep = createStep({
  id: "summarize",
  inputSchema: z.object({
    schema: z.array(z.any()),
    shape: z.tuple([z.number(), z.number()]),
    userMessage: z.string(),
  }),
  outputSchema: z.object({
    summary: z.any(),
    userMessage: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { summary } = await getBridge().call<{ summary: unknown }>("summarize", {});
    return { summary, userMessage: inputData.userMessage };
  },
});
