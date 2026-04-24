/* eslint-disable no-console */
import { orchestrateDiscovery } from "../src/lib/agents/orchestrator";

(async () => {
  const skipSearch = process.argv.includes("--skip-search");
  const result = await orchestrateDiscovery({ skipSearch });
  console.log(JSON.stringify(result, null, 2));
})();
