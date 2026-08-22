import { Buffer } from "node:buffer";

export const MAX_NATIVE_MESSAGE_BYTES = 2_000_000;

export type NativeMessagingErrorCode =
  | "INVALID_LENGTH"
  | "TRUNCATED_FRAME"
  | "INVALID_UTF8"
  | "INVALID_JSON";

export class NativeMessagingError extends Error {
  readonly code: NativeMessagingErrorCode;

  constructor(code: NativeMessagingErrorCode, message: string) {
    super(message);
    this.name = "NativeMessagingError";
    this.code = code;
  }
}

export function encodeNativeMessage(value: unknown): Buffer {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new NativeMessagingError("INVALID_JSON", "协议消息无法序列化");
  }

  const payload = Buffer.from(serialized, "utf8");
  if (payload.length > MAX_NATIVE_MESSAGE_BYTES) {
    throw new NativeMessagingError("INVALID_LENGTH", "协议消息超出长度限制");
  }

  const frame = Buffer.allocUnsafe(4 + payload.length);
  frame.writeUInt32LE(payload.length, 0);
  payload.copy(frame, 4);
  return frame;
}

export class NativeMessageParser {
  private pending = Buffer.alloc(0);

  push(chunk: Uint8Array): unknown[] {
    this.pending = Buffer.concat([this.pending, Buffer.from(chunk)]);
    const messages: unknown[] = [];

    while (this.pending.length >= 4) {
      const payloadLength = this.pending.readUInt32LE(0);
      if (payloadLength > MAX_NATIVE_MESSAGE_BYTES) {
        throw new NativeMessagingError("INVALID_LENGTH", "协议帧长度无效");
      }
      if (this.pending.length < payloadLength + 4) {
        break;
      }

      const payload = this.pending.subarray(4, payloadLength + 4);
      this.pending = this.pending.subarray(payloadLength + 4);
      let serialized: string;
      try {
        serialized = new TextDecoder("utf-8", { fatal: true }).decode(payload);
      } catch {
        throw new NativeMessagingError("INVALID_UTF8", "协议帧不是有效 UTF-8");
      }
      try {
        messages.push(JSON.parse(serialized) as unknown);
      } catch {
        throw new NativeMessagingError("INVALID_JSON", "协议帧不是有效 JSON");
      }
    }

    return messages;
  }

  finish(): void {
    if (this.pending.length > 0) {
      throw new NativeMessagingError("TRUNCATED_FRAME", "Native Messaging 帧被截断");
    }
  }
}

export async function* readNativeMessages(
  input: NodeJS.ReadableStream
): AsyncGenerator<unknown> {
  const parser = new NativeMessageParser();
  for await (const chunk of input) {
    const messages = parser.push(chunk as Uint8Array);
    for (const message of messages) {
      yield message;
    }
  }
  parser.finish();
}

export async function writeNativeMessage(
  output: NodeJS.WritableStream,
  value: unknown
): Promise<void> {
  const frame = encodeNativeMessage(value);
  await new Promise<void>((resolve, reject) => {
    output.write(frame, (error?: Error | null) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
