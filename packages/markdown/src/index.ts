export const PACKAGE_NAME = "@capture-for-tolaria/markdown" as const;

export const MARKDOWN_FORMAT = "turndown-gfm" as const;

export const FRONTMATTER_REQUIRED_FIELDS = [
  "title",
  "source_url",
  "clipped",
  "type"
] as const;

export {
  serializeFrontmatter,
  type Frontmatter,
  type MarkdownDocument
} from "./frontmatter.js";
export { renderMarkdown } from "./convert.js";
