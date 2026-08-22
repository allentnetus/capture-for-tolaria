export type Frontmatter = Record<string, string | undefined>;

export interface MarkdownDocument {
  frontmatter: Frontmatter;
  markdown: string;
  title: string;
  sourceUrl: string;
}

export function serializeFrontmatter(frontmatter: Frontmatter): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value !== undefined) {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}
