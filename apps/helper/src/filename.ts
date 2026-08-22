import { FileChannelError } from "./errors.js";

const INVALID_FILENAME_CHARACTERS = /[<>:"/\\|?*]/u;
const RESERVED_WINDOWS_NAME = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/iu;
const MAX_TITLE_LENGTH = 120;

export function sanitizeTitle(title: string): string {
  const normalizedTitle = title.normalize("NFC");
  const cleaned = Array.from(normalizedTitle, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || INVALID_FILENAME_CHARACTERS.test(character)
      ? "-"
      : character;
  })
    .join("")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[. ]+$/gu, "")
    .slice(0, MAX_TITLE_LENGTH)
    .replace(/[. ]+$/gu, "");

  const visibleTitle = cleaned.length > 0 ? cleaned : "Untitled";
  if (RESERVED_WINDOWS_NAME.test(visibleTitle)) {
    return `_${visibleTitle}`;
  }
  return visibleTitle;
}

function dateStamp(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new FileChannelError("WRITE_FAILED", "捕获时间无效");
  }
  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}${month}${day}`;
}

export function buildMarkdownFilename(title: string, date = new Date()): string {
  return `${dateStamp(date)} - ${sanitizeTitle(title)}.md`;
}

export function addConflictSuffix(filename: string, attempt: number): string {
  if (attempt < 2 || !filename.endsWith(".md")) {
    return filename;
  }
  return `${filename.slice(0, -3)} (${attempt}).md`;
}
