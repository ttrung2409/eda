import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { getBridge } from "./pythonBridge.js";

export const chartBasedResponseStep = createStep({
  id: "visualize",
  inputSchema: z.object({
    kind: z.enum(["chart", "text"]),
    payload: z.string(),
    summary: z.any(),
    userMessage: z.string(),
  }),
  outputSchema: z.object({ code: z.string() }),
  execute: async ({ inputData }) => {
    const { code } = await getBridge().call<{ code: string }>("visualize", {
      summary: inputData.summary,
      goal: inputData.payload,
    });
    return { code };
  },
});
