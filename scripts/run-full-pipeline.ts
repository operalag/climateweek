/* eslint-disable no-console */
import { orchestrateFull } from "../src/lib/agents/orchestrator";

(async () => {
  const result = await orchestrateFull({ enrichLimit: 20, newsLimit: 25, scoreLimit: 50 });
  console.log(JSON.stringify(result, null, 2));
})();
