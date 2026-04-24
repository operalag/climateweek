/* eslint-disable no-console */
import { orchestrateEnrich } from "../src/lib/agents/orchestrator";

(async () => {
  const limit = Number(process.argv[2] ?? 20);
  const result = await orchestrateEnrich(limit);
  console.log(JSON.stringify(result, null, 2));
})();
