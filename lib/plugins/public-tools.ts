// Shared tool identifiers only; no provider, credential or billing imports.
export const PUBLIC_TOOLS = ["wikipedia_search", "wikipedia_read", "arxiv_search", "scholar_search", "crossref_lookup", "wolfram_query"] as const;
export type PublicTool = (typeof PUBLIC_TOOLS)[number];
export const isPublicTool = (v: unknown): v is PublicTool => typeof v === "string" && (PUBLIC_TOOLS as readonly string[]).includes(v);
