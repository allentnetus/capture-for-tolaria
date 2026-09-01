import { relativeFolderSchema } from "@capture-for-tolaria/protocol";
import { DEFAULT_RELATIVE_FOLDER } from "../background/messages.js";

const DEFAULT_RELATIVE_FOLDER_KEY = "defaultRelativeFolder";

export interface ExtensionStorage {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

function defaultStorage(): ExtensionStorage {
  return chrome.storage.local as unknown as ExtensionStorage;
}

export async function getDefaultRelativeFolder(
  storage: ExtensionStorage = defaultStorage()
): Promise<string> {
  try {
    const items = await storage.get(DEFAULT_RELATIVE_FOLDER_KEY);
    const value = items[DEFAULT_RELATIVE_FOLDER_KEY];
    if (typeof value !== "string") {
      return DEFAULT_RELATIVE_FOLDER;
    }
    return relativeFolderSchema.parse(value);
  } catch {
    return DEFAULT_RELATIVE_FOLDER;
  }
}

export async function setDefaultRelativeFolder(
  value: string,
  storage: ExtensionStorage = defaultStorage()
): Promise<void> {
  const relativeFolder = relativeFolderSchema.parse(value);
  await storage.set({ [DEFAULT_RELATIVE_FOLDER_KEY]: relativeFolder });
}
