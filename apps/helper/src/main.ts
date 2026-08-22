import { handleRawRequest } from "./request-handler.js";
import { readNativeMessages, writeNativeMessage } from "./native-messaging.js";

export async function runHelper(
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout
): Promise<void> {
  for await (const message of readNativeMessages(input)) {
    const response = await handleRawRequest(message);
    await writeNativeMessage(output, response);
  }
}

const entryPath = process.argv[1];
if (entryPath && /(?:^|[\\/])main\.js$/u.test(entryPath)) {
  runHelper().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Helper failed");
    process.exitCode = 1;
  });
}
