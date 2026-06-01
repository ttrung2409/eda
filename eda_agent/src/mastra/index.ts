import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { edaWorkflow } from "./eda.workflow.js";

export const mastra = new Mastra({
  storage: new LibSQLStore({ id: "mastra-storage", url: "file::memory:?cache=shared" }),
  workflows: { eda: edaWorkflow },
});

export { edaWorkflow };
