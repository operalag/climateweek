/* eslint-disable no-console */
import { orchestrateScore } from "../src/lib/agents/orchestrator";

(async () => {
  const limit = Number(process.argv[2] ?? 50);
  const result = await orchestrateScore(limit);
  console.log(JSON.stringify(result, null, 2));
})();
