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
export const MAX_VAULT_ROOT_LENGTH = 4_096;
export const MAX_IMAGE_CANDIDATES = 128;
export const MAX_IMAGE_ALT_TEXT_LENGTH = 512;

const boundedIdentifier = (label: string, max: number) =>
  z.string().trim().min(1, `${label} 不能为空`).max(max, `${label} 超出长度限制`);

export const relativeFolderSchema = z
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

const httpUrl = (label: string, max: number) => z
  .string()
  .trim()
  .min(1, `${label} 不能为空`)
  .max(max, `${label} 超出长度限制`)
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
  }, `${label} 必须是无凭据的 HTTP 或 HTTPS URL`);

const httpSourceUrl = httpUrl("sourceUrl", MAX_SOURCE_URL_LENGTH);

const imageCandidateSchema = z
  .object({
    remoteUrl: httpUrl("images.remoteUrl", MAX_SOURCE_URL_LENGTH),
    altText: z
      .string()
      .max(MAX_IMAGE_ALT_TEXT_LENGTH, "images.altText 超出长度限制")
      .optional()
  })
  .strict();

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
    relativeFolder: relativeFolderSchema,
    title: boundedIdentifier("title", MAX_TITLE_LENGTH),
    markdown: z
      .string()
      .min(1, "markdown 不能为空")
      .max(MAX_MARKDOWN_CHARACTERS, "markdown 超出长度限制"),
    sourceUrl: httpSourceUrl,
    metadata: metadataSchema,
    images: z
      .array(imageCandidateSchema)
      .max(MAX_IMAGE_CANDIDATES, "images 候选过多")
      .optional()
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

const requestBase = {
  protocolVersion: z.literal(PROTOCOL_VERSION),
  requestId: boundedIdentifier("requestId", MAX_REQUEST_ID_LENGTH),
  extensionVersion: boundedIdentifier("extensionVersion", MAX_VERSION_LENGTH)
};

export const vaultConfigGetRequestSchema = z.object({
  ...requestBase,
  action: z.literal("vault.config.get")
}).strict();

export const vaultConfigSetRequestSchema = z.object({
  ...requestBase,
  action: z.literal("vault.config.set"),
  payload: z.object({
    vaultRoot: z.string().trim().min(1, "vaultRoot 不能为空").max(MAX_VAULT_ROOT_LENGTH, "vaultRoot 超出长度限制")
  }).strict()
}).strict();

export const requestSchema = z.discriminatedUnion("action", [
  helloRequestSchema,
  articleRequestSchema,
  vaultConfigGetRequestSchema,
  vaultConfigSetRequestSchema
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

const responsePath = z
  .string()
  .min(1, "relativePath 不能为空")
  .max(MAX_RESPONSE_PATH_LENGTH, "relativePath 超出长度限制");

const localizedAssetSchema = z
  .object({
    remoteUrl: httpUrl("assets.remoteUrl", MAX_SOURCE_URL_LENGTH),
    relativePath: responsePath,
    contentType: boundedIdentifier("contentType", 128),
    byteLength: z
      .number()
      .int("byteLength 必须是整数")
      .min(0, "byteLength 不能为负数")
      .max(8 * 1024 * 1024, "byteLength 超出单图限制")
  })
  .strict();

const assetSummarySchema = z
  .object({
    requested: z.number().int().min(0),
    localized: z.number().int().min(0),
    fallback: z.number().int().min(0)
  })
  .strict();

const clipResultSchema = z
  .object({
    relativePath: responsePath,
    assets: z.array(localizedAssetSchema).max(MAX_IMAGE_CANDIDATES).optional(),
    summary: assetSummarySchema.optional(),
    warnings: z.array(z.string().max(512)).max(128).optional()
  })
  .strict();

export const successResponseSchema = z
  .object({
    ...responseBase,
    ok: z.literal(true),
    result: clipResultSchema
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

export const vaultConfigResponseSchema = z.union([
  z.object({
    ...responseBase,
    ok: z.literal(true),
    result: z.object({
      vaultRoot: z.string().min(1).max(MAX_VAULT_ROOT_LENGTH)
    }).strict()
  }).strict(),
  errorResponseSchema
]);
