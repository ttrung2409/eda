import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { loadDataStep } from "./loadData.step.js";
import { summarizeStep } from "./summarize.step.js";
import { clarifyStep } from "./clarify.step.js";
import { chartBasedResponseStep } from "./chartBasedResponse.step.js";
import { textBasedResponseStep } from "./textBasedResponse.step.js";

export const edaWorkflow = createWorkflow({
  id: "eda",
  inputSchema: z.object({
    filePath: z.string(),
    userMessage: z.string(),
  }),
  outputSchema: z.any(),
});

edaWorkflow
  .then(loadDataStep)
  .then(summarizeStep)
  .then(clarifyStep)
  .branch([
    [async ({ inputData }) => inputData.kind === "chart", chartBasedResponseStep],
    [async ({ inputData }) => inputData.kind === "text", textBasedResponseStep],
  ])
  .commit();
