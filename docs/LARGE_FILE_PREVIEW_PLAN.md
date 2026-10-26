# 512 MB files and in-app document preview

**Approved scope:** Noah asked for uploads up to 512 MB and in-app viewing of chat/course documents on October 26, 2026. He confirmed that large files must be usable as AI reference material and that Word/PowerPoint previews should retain their page/slide layout.

## Outcome and boundaries

- A student can upload a supported document up to **512 MiB** from a chat, course, or graded section. Large transfers resume after transient network loss and show progress.
- PDF, DOCX, PPTX and other supported Office documents open in an Orbit dialog. PDF uses the original document; Office uses a privately stored PDF rendition, so page/slide layout is preserved as closely as the converter permits. The original remains downloadable.
- A background processor indexes text with page/slide references. Chat and Orbit use the existing relevant-excerpt retrieval and citation path after indexing. The app shows `Processing`, `Ready`, or a failure; it never claims that an unindexed file was read.
- A 512 MiB file cannot fit into an LLM context window. Retrieval selects bounded passages per question, and students can request specific pages or slides. Large scanned/visual pages are disclosed as unreadable by the AI unless the student supplies a smaller PDF or screenshots.
- Images retain a smaller model-compatible upload cap and browser resize path. Unsupported legacy formats are not claimed as AI-readable.

## Implementation

1. Browser uploads over 6 MiB use Supabase resumable TUS directly to private Storage. Smaller uploads keep the existing direct path. Server validates owner, object metadata and size before creating a file row. Uploads bucket and global Storage settings must permit 512 MiB.
2. Add a queued-processing file state and private `preview_path` metadata. Small files use the current synchronous extraction. Large documents are recorded as queued without downloading them through Vercel.
3. A separate non-root container worker claims queued rows, streams the original to disk, converts Office documents to PDF with LibreOffice, extracts PDF text with Poppler, and writes page-scoped passages in batches. It uploads the preview to private Storage and marks completion. Claims, retries and cleanup are bounded; failures are explicit. The worker never sends content to an AI provider.
   The provided Compose service caps native memory at 4 GiB and scratch space at 2 GiB. A heartbeat and attempt-fenced database functions prevent a stale worker from mixing chunks with a replacement attempt. Office previews use attempt-specific object paths. Existing ready Office files are queued by migration 0026.
4. Owner-checked API returns a short-lived signed URL for the original/preview. The in-app viewer uses an iframe for PDF and native rendering for images. Text and other formats use a download action rather than framing potentially active HTML. Open controls are available on saved chat attachments and course/section/folder files.

## Risk review and deployment gates

- **Memory/time:** Vercel must never receive or parse a 512 MiB body. Worker disk and process limits require load testing with synthetic 512 MiB PDFs and media-heavy PPTX/DOCX.
- **Extraction bounds:** uploads can be 512 MiB, but extracted output over 100 MiB, more than 50 million indexed characters, or one page over 2 million characters fails visibly; the original remains stored for viewing/download. These limits prevent compressed-file expansion from overwhelming the worker and database. This is not complete AI reading for every possible 512 MiB file.
- **Privacy:** private buckets, per-user RLS, short-lived signed URLs, no third-party Office viewer, no content logging. Converter runs without root privileges and with resource limits.
- **Cost:** 512 MiB originals plus preview renditions and a searchable index can be expensive. Monitor storage/egress/database growth; keep the chosen 512 MiB cap explicit rather than implying unlimited capacity.
- **Correctness:** text extraction may miss scans, charts, speaker notes or unusual fonts. Large-file scans/diagrams are not visually read by AI in this iteration. Preview rendition may differ in proprietary Office effects; disclose conversion failures and keep the original accessible. Search results retain file/page identity and context-budget notices. Syllabus import is a separate 20 MB path.
- **Release:** requires a new additive migration, a legacy-path audit before validating its `NOT VALID` path constraints, Supabase global upload limit at least 512 MiB on an eligible plan, a deployed worker with enforced memory/scratch quotas and service-role credentials, signed-in staging checks, and explicit production authorization. No shared database or production settings are changed by this branch.

## Acceptance checks

- Small-file regression and exact 512 MiB boundary; file over the cap rejected before transfer.
- Large TUS success/resume/failure without Vercel file bodies; ownership and size spoofing rejected.
- Worker claims one file once, indexes late-page evidence, preserves output and source identity, recovers from failed conversion, and cleans temporary files.
- Chat/Orbit never use queued or failed files as if indexed. PDF/Office preview opens and closes on desktop and phone; another user's file returns 404.
- Build, lint, typecheck, focused tests, synthetic 512 MiB trial, then signed-in staging and a second-model review of the context change before merging.
