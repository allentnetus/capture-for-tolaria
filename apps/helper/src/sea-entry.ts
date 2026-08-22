import { runHelper } from "./main.js";

runHelper().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Helper failed");
  process.exitCode = 1;
});
