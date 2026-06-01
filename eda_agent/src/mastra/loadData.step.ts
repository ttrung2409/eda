import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { getBridge } from "./pythonBridge.js";

export const loadDataStep = createStep({
  id: "load-data",
  inputSchema: z.object({
    filePath: z.string(),
    userMessage: z.string(),
  }),
  outputSchema: z.object({
    schema: z.array(z.object({ column: z.string(), dtype: z.string(), samples: z.array(z.string()) })),
    shape: z.tuple([z.number(), z.number()]),
    userMessage: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { schema, shape } = await getBridge().call<{
      schema: Array<{ column: string; dtype: string; samples: string[] }>;
      shape: [number, number];
    }>("loadData", { filePath: inputData.filePath });
    return { schema, shape, userMessage: inputData.userMessage };
  },
});
