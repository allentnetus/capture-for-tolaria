import { z } from "zod";
import { PROTOCOL_VERSION } from "./types.js";

export const MAX_REQUEST_ID_LENGTH = 128;
export const MAX_VERSION_LENGTH = 64;
export const MAX_RELATIVE_FOLDER_LENGTH = 512;
export const MAX_TITLE_LENGTH = 240;
export const MAX_MARKDOWN_CHARACTERS = 1_000_000;
export const MAX_SOURCE_URL_LENGTH = 2_048;
export const MAX_METADATA_KEY_LENGTH = 64;
export const MAX_METADATA_VALUE_LENGTH = 512;
export const MAX_RESPONSE_PATH_LENGTH = 1_024;

const boundedIdentifier = (label: string, max: number) =>
  z.string().trim().min(1, `${label} 不能为空`).max(max, `${label} 超出长度限制`);

const safeRelativeFolder = z
  .string()
  .trim()
  .min(1, "relativeFolder 不能为空")
  .max(MAX_RELATIVE_FOLDER_LENGTH, "relativeFolder 超出长度限制")
  .refine((value) => {
    if (value.includes("\u0000") || /^[\\/]/u.test(value) || /^[A-Za-z]:/u.test(value)) {
      return false;
    }

    const segments = value.split(/[\\/]/u);
    return segments.every(
      (segment) =>
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        !/[<>:"|?*]/u.test(segment)
    );
  }, "relativeFolder 必须是安全的相对目录");

const httpSourceUrl = z
  .string()
  .trim()
  .min(1, "sourceUrl 不能为空")
  .max(MAX_SOURCE_URL_LENGTH, "sourceUrl 超出长度限制")
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        url.username.length === 0 &&
        url.password.length === 0
      );
    } catch {
      return false;
    }
  }, "sourceUrl 必须是无凭据的 HTTP 或 HTTPS URL");

const metadataSchema = z
  .record(
    z
      .string()
      .min(1, "metadata key 不能为空")
      .max(MAX_METADATA_KEY_LENGTH, "metadata key 超出长度限制"),
    z.string().max(MAX_METADATA_VALUE_LENGTH, "metadata value 超出长度限制").optional()
  )
  .refine((metadata) => Object.keys(metadata).length <= 32, "metadata 条目过多");

export const articlePayloadSchema = z
  .object({
    relativeFolder: safeRelativeFolder,
    title: boundedIdentifier("title", MAX_TITLE_LENGTH),
    markdown: z
      .string()
      .min(1, "markdown 不能为空")
      .max(MAX_MARKDOWN_CHARACTERS, "markdown 超出长度限制"),
    sourceUrl: httpSourceUrl,
    metadata: metadataSchema
  })
  .strict();

export const helloRequestSchema = z
  .object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    requestId: boundedIdentifier("requestId", MAX_REQUEST_ID_LENGTH),
    extensionVersion: boundedIdentifier("extensionVersion", MAX_VERSION_LENGTH),
    action: z.literal("hello")
  })
  .strict();

export const articleRequestSchema = z
  .object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    requestId: boundedIdentifier("requestId", MAX_REQUEST_ID_LENGTH),
    extensionVersion: boundedIdentifier("extensionVersion", MAX_VERSION_LENGTH),
    action: z.literal("clip.article"),
    payload: articlePayloadSchema
  })
  .strict();

export const requestSchema = z.discriminatedUnion("action", [
  helloRequestSchema,
  articleRequestSchema
]);

export const helloResponseSchema = z
  .object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    helperVersion: boundedIdentifier("helperVersion", MAX_VERSION_LENGTH),
    capabilities: z
      .array(boundedIdentifier("capability", 64))
      .max(32, "capabilities 过多")
  })
  .strict();


const responseBase = {
  protocolVersion: z.literal(PROTOCOL_VERSION),
  requestId: boundedIdentifier("requestId", MAX_REQUEST_ID_LENGTH),
  helperVersion: boundedIdentifier("helperVersion", MAX_VERSION_LENGTH)
};

export const successResponseSchema = z
  .object({
    ...responseBase,
    ok: z.literal(true),
    result: z
      .object({
        relativePath: z
          .string()
          .min(1, "relativePath 不能为空")
          .max(MAX_RESPONSE_PATH_LENGTH, "relativePath 超出长度限制")
      })
      .strict()
  })
  .strict();

export const errorResponseSchema = z
  .object({
    ...responseBase,
    ok: z.literal(false),
    error: z
      .object({
        code: boundedIdentifier("error.code", 64),
        message: boundedIdentifier("error.message", 512)
      })
      .strict()
  })
  .strict();

export const responseSchema = z.union([successResponseSchema, errorResponseSchema]);
