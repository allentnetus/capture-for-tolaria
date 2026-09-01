import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { expect, it } from "vitest";
import {
  MAX_NATIVE_MESSAGE_BYTES,
  NativeMessageParser,
  NativeMessagingError,
  encodeNativeMessage,
  readNativeMessages
} from "../src/index.js";
import { PROTOCOL_VERSION } from "@capture-for-tolaria/protocol";

function frame(payload: Buffer): Buffer {
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

it("使用 4-byte little-endian 长度和 UTF-8 JSON", () => {
  const encoded = encodeNativeMessage({ message: "中文" });
  expect(encoded.readUInt32LE(0)).toBe(encoded.length - 4);
  expect(new NativeMessageParser().push(encoded)).toEqual([{ message: "中文" }]);
});

it("支持分段读取和连续多消息", () => {
  const first = encodeNativeMessage({ id: 1 });
  const second = encodeNativeMessage({ id: 2 });
  const parser = new NativeMessageParser();
  expect(parser.push(Buffer.concat([first, second]).subarray(0, 3))).toEqual([]);
  expect(parser.push(Buffer.concat([first, second]).subarray(3))).toEqual([
    { id: 1 },
    { id: 2 }
  ]);
  parser.finish();
});

it("拒绝非法长度、非法 JSON、非法 UTF-8 和截断帧", () => {
  expect(() => new NativeMessageParser().push(Buffer.from([255, 255, 255, 127]))).toThrow(
    NativeMessagingError
  );
  expect(() => new NativeMessageParser().push(frame(Buffer.from("not json")))).toThrow(
    NativeMessagingError
  );
  expect(() => new NativeMessageParser().push(frame(Buffer.from([255])))).toThrow(
    NativeMessagingError
  );

  const parser = new NativeMessageParser();
  parser.push(Buffer.from([3, 0, 0, 0, 123]));
  expect(() => parser.finish()).toThrow(NativeMessagingError);
});

it("不会把 stdout 日志当作协议消息", () => {
  expect(() => new NativeMessageParser().push(Buffer.from("debug log\n"))).toThrow(
    NativeMessagingError
  );
});

it("能够从 Node stream 读取完整消息", async () => {
  const messages = [];
  for await (const message of readNativeMessages(
    Readable.from([encodeNativeMessage({ ok: true })])
  )) {
    messages.push(message);
  }
  expect(messages).toEqual([{ ok: true }]);
});

it("将 images 元数据计入完整 Native Messaging 帧长度预算", () => {
  const largeMarkdown = "中".repeat(600_000);
  const baseRequest = {
    protocolVersion: PROTOCOL_VERSION,
    requestId: "req-large-images",
    extensionVersion: "0.1.0-beta.3",
    action: "clip.article",
    payload: {
      relativeFolder: "Inbox/Web",
      title: "Large image metadata",
      markdown: largeMarkdown,
      sourceUrl: "https://example.com/article",
      metadata: {}
    }
  };
  const images = Array.from({ length: 128 }, (_, index) => ({
    remoteUrl: `https://cdn.example/${String(index).padStart(3, "0")}${"a".repeat(2_000)}.png`,
    altText: "图".repeat(170)
  }));

  expect(encodeNativeMessage(baseRequest).length).toBeLessThanOrEqual(
    MAX_NATIVE_MESSAGE_BYTES + 4
  );
  expect(() => encodeNativeMessage({
    ...baseRequest,
    payload: { ...baseRequest.payload, images }
  })).toThrow(NativeMessagingError);
});
