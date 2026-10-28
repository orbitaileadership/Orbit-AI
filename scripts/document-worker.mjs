// Private document processor. Run as a separate container; never inside a Vercel request.
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Use --once for a bounded staging run.
import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 512 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 100 * 1024 * 1024;
const MAX_PAGE_CHARS = 2_000_000;
const MAX_INDEX_CHARS = 50_000_000;
const MAX_CHUNKS = 36_000;
const POLL_MS = Math.max(2_000, Number(process.env.DOCUMENT_WORKER_POLL_MS ?? 10_000));
const CONVERT_TIMEOUT_MS = 20 * 60_000;
const BATCH = 300;
const OFFICE = new Map([
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
]);
const PDF = "application/pdf";
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export function validateJob(row) {
  const path = row.storage_path;
  const ownPrefix = `${row.user_id}/${row.id}/`;
  if (typeof path !== "string" || !path.startsWith(ownPrefix) || path.includes("..") || path.length <= ownPrefix.length) throw new Error("unsafe_storage_path");
  if (!Number.isSafeInteger(row.size_bytes) || row.size_bytes <= 0 || row.size_bytes > MAX_BYTES) throw new Error("unsafe_storage_size");
  if (row.mime !== PDF && !OFFICE.has(row.mime) && !row.mime?.startsWith("text/") && row.mime !== "application/x-ipynb+json") throw new Error("unsupported_worker_format");
}

/** No shell: paths are fixed and LibreOffice never receives a student-controlled filename. */
export function command(program, args, timeoutMs = CONVERT_TIMEOUT_MS, outputPath = null, outputLimit = MAX_BYTES) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { stdio: "ignore", windowsHide: true });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    let overflow = false;
    const monitor = outputPath && setInterval(async () => {
      const size = (await stat(outputPath).catch(() => null))?.size ?? 0;
      if (size > outputLimit) { overflow = true; child.kill("SIGKILL"); }
    }, 1_000);
    const clear = () => { clearTimeout(timer); if (monitor) clearInterval(monitor); };
    child.once("error", error => { clear(); reject(error); });
    child.once("exit", code => { clear(); if (overflow) reject(new Error("extracted_output_too_large")); else if (code === 0) resolve(); else reject(new Error(`${program}_exit_${code}`)); });
  });
}

async function streamDownload(client, row, destination) {
  const { data, error } = await client.storage.from("uploads").createSignedUrl(row.storage_path, 60 * 60);
  if (error || !data?.signedUrl) throw new Error("storage_sign_failed");
  const response = await fetch(data.signedUrl, { signal: AbortSignal.timeout(CONVERT_TIMEOUT_MS) });
  if (!response.ok || !response.body) throw new Error("storage_download_failed");
  let received = 0;
  const limit = new Transform({ transform(chunk, _, done) {
    received += chunk.length;
    done(received > row.size_bytes || received > MAX_BYTES ? new Error("storage_size_mismatch") : null, chunk);
  } });
  await pipeline(Readable.fromWeb(response.body), limit, createWriteStream(destination, { flags: "wx" }));
  const { size } = await stat(destination);
  if (size !== row.size_bytes || size > MAX_BYTES) throw new Error("storage_size_mismatch");
}

/** Streams a form-feed-separated PDF text file into page-scoped passages. */
export async function indexText(path, isPdf, append) {
  const deadline = Date.now() + CONVERT_TIMEOUT_MS;
  let pending = "", page = 1, chars = 0, pages = 0, chunkIndex = 0;
  const visualPages = [];
  const emit = async (text, pageNumber) => {
    const cleaned = text.replace(/\u0000/g, "").trim();
    if (cleaned.length > MAX_PAGE_CHARS || chars + cleaned.length > MAX_INDEX_CHARS) throw new Error("index_text_limit");
    chars += cleaned.length;
    if (isPdf) {
      pages++;
      if (cleaned.length < 40) visualPages.push(pageNumber);
    }
    for (let start = 0; start < cleaned.length; start += 1_400) {
      if (chunkIndex >= MAX_CHUNKS) throw new Error("index_chunk_limit");
      await append({ page: isPdf ? pageNumber : null, chunk_index: chunkIndex++, content: cleaned.slice(start, start + 1_400) });
    }
  };
  for await (const part of createReadStream(path, { encoding: "utf8", highWaterMark: 64 * 1024 })) {
    if (Date.now() > deadline) throw new Error("index_timeout");
    pending += part;
    if (isPdf) {
      let breakAt;
      while ((breakAt = pending.indexOf("\f")) >= 0) {
        await emit(pending.slice(0, breakAt), page++);
        pending = pending.slice(breakAt + 1);
      }
      if (pending.length > MAX_PAGE_CHARS) throw new Error("index_page_limit");
    } else {
      while (pending.length >= 2_800) {
        await emit(pending.slice(0, 1_400), 0);
        pending = pending.slice(1_400);
      }
    }
  }
  if (pending.trim()) await emit(pending, page);
  return { charCount: chars, pageCount: isPdf ? pages : null, visualPages, status: isPdf && pages > 0 && chars / pages < 40 ? "needs_ocr" : "ready" };
}

export async function claim(client) {
  const columns = "id,user_id,name,mime,size_bytes,storage_path,status,preview_status,processing_attempts";
  const { data: indexJobs, error } = await client.from("files")
    .select(columns).eq("status", "queued").order("created_at").limit(5);
  if (error) throw error;
  const { data: previews, error: previewError } = await client.from("files")
    .select(columns).eq("status", "ready").eq("preview_status", "queued").order("created_at").limit(5);
  if (previewError) throw previewError;
  for (const row of [...(indexJobs ?? []), ...(previews ?? [])]) {
    if (row.processing_attempts >= 3) {
      await client.from("files").update(row.status === "queued"
        ? { status: "failed", preview_status: OFFICE.has(row.mime) ? "failed" : null, error: "Document processing failed after three attempts." }
        : { preview_status: "failed" }).eq("id", row.id);
      continue;
    }
    const indexing = row.status === "queued";
    const update = indexing
      ? { status: "processing", ...(OFFICE.has(row.mime) ? { preview_status: "processing" } : {}), processing_started_at: new Date().toISOString(), processing_attempts: row.processing_attempts + 1 }
      : { preview_status: "processing", processing_started_at: new Date().toISOString(), processing_attempts: row.processing_attempts + 1 };
    let query = client.from("files").update(update).eq("id", row.id).eq("processing_attempts", row.processing_attempts);
    query = indexing ? query.eq("status", "queued") : query.eq("status", "ready").eq("preview_status", "queued");
    const { data: claimed, error: claimError } = await query.select("id").maybeSingle();
    if (claimError) throw claimError;
    if (claimed) return { ...row, indexing };
  }
  return null;
}

async function recoverStale(client) {
  const cutoff = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data: stalled } = await client.from("files").select("id,status,preview_status,processing_attempts")
    .lt("processing_started_at", cutoff).or("status.eq.processing,preview_status.eq.processing").limit(20);
  for (const row of stalled ?? []) {
    const retry = row.processing_attempts < 3;
    await client.from("files").update(row.status === "processing"
      ? { status: retry ? "queued" : "failed", preview_status: row.preview_status === "processing" ? retry ? "queued" : "failed" : row.preview_status, error: retry ? null : "Document processing timed out.", processing_started_at: null }
      : { preview_status: retry ? "queued" : "failed", processing_started_at: null })
      .eq("id", row.id).lt("processing_started_at", cutoff);
  }
}

async function processOne(client, row) {
  const dir = await mkdtemp(join(tmpdir(), "orbit-doc-"));
  const source = join(dir, `source.${OFFICE.get(row.mime) ?? (row.mime === PDF ? "pdf" : "txt")}`);
  const output = join(dir, "source.pdf");
  const attempt = row.processing_attempts + 1;
  let leaseLost = false, renewing = false;
  const heartbeat = setInterval(async () => {
    if (renewing || leaseLost) return;
    renewing = true;
    try {
      const { data, error } = await client.from("files").update({ processing_started_at: new Date().toISOString() })
        .eq("id", row.id).eq("processing_attempts", attempt)
        .eq(row.indexing ? "status" : "preview_status", "processing").select("id").maybeSingle();
      if (error || !data) leaseLost = true;
    } catch { leaseLost = true; }
    finally { renewing = false; }
  }, 60_000);
  const checkLease = () => { if (leaseLost) throw new Error("document_claim_lost"); };
  let previewPath = null;
  let uploadedPreview = false;
  let finalized = false;
  try {
    validateJob(row);
    await streamDownload(client, row, source);
    checkLease();
    const office = OFFICE.has(row.mime);
    if (office) {
      await command("libreoffice", [`-env:UserInstallation=file://${join(dir, "profile").replaceAll("\\", "/")}`, "--headless", "--convert-to", "pdf", "--outdir", dir, source], CONVERT_TIMEOUT_MS, output);
      checkLease();
      const { size } = await stat(output);
      if (!size || size > MAX_BYTES) throw new Error("preview_too_large");
      previewPath = `${row.user_id}/${row.id}/orbit-preview-${attempt}.pdf`;
      const { error } = await client.storage.from("uploads").upload(previewPath, createReadStream(output), { contentType: PDF, upsert: true });
      if (error) throw new Error("preview_upload_failed");
      uploadedPreview = true;
    }
    if (row.indexing) {
      const pdf = office ? output : row.mime === PDF ? source : null;
      const text = pdf ? join(dir, "text.txt") : source;
      if (pdf) await command("pdftotext", ["-enc", "UTF-8", "-layout", pdf, text], CONVERT_TIMEOUT_MS, text, MAX_EXTRACTED_BYTES);
      checkLease();
      if ((await stat(text)).size > MAX_EXTRACTED_BYTES) throw new Error("extracted_output_too_large");
      // Retry must never leave passages from a partial earlier attempt.
      const { error: clearError } = await client.rpc("begin_document_index", { p_file_id: row.id, p_attempt: attempt });
      if (clearError) throw clearError;
      let batch = [];
      const flush = async () => {
        if (!batch.length) return;
        checkLease();
        const { error } = await client.rpc("append_document_chunks", { p_file_id: row.id, p_attempt: attempt, p_chunks: batch.map(({ page, chunk_index, content }) => ({ page, chunk_index, content })) });
        if (error) throw error;
        batch = [];
      };
      const extracted = await indexText(text, Boolean(pdf), async chunk => {
        batch.push({ file_id: row.id, user_id: row.user_id, ...chunk });
        if (batch.length >= BATCH) await flush();
      });
      await flush();
      checkLease();
      const { data: saved, error: savedError } = await client.from("files").update({
        status: extracted.status, char_count: extracted.charCount, page_count: extracted.pageCount,
        visual_pages: extracted.visualPages, error: extracted.status === "needs_ocr" ? "Scanned pages need model vision for detailed reading." : null,
        ...(office ? { preview_status: "ready", preview_path: previewPath } : {}),
        processing_started_at: null,
      }).eq("id", row.id).eq("status", "processing").eq("processing_attempts", attempt).select("id").maybeSingle();
      if (savedError || !saved) throw savedError ?? new Error("file_removed_during_processing");
    } else {
      const { data: saved, error } = await client.from("files").update({ preview_status: "ready", preview_path: previewPath, processing_started_at: null })
        .eq("id", row.id).eq("preview_status", "processing").eq("processing_attempts", attempt).select("id").maybeSingle();
      if (error || !saved) throw error ?? new Error("file_removed_during_processing");
    }
    finalized = true;
  } catch (error) {
    // Student-visible status is explicit; neither document contents nor raw parser errors are logged.
    const retry = row.processing_attempts + 1 < 3;
    await client.from("files").update(row.indexing
      ? { status: retry ? "queued" : "failed", preview_status: OFFICE.has(row.mime) ? retry ? "queued" : "failed" : null, error: retry ? null : "This file could not be indexed. Download the original or try another copy.", processing_started_at: null }
      : { preview_status: retry ? "queued" : "failed", processing_started_at: null })
      .eq("id", row.id).eq("processing_attempts", attempt);
    throw error;
  } finally {
    clearInterval(heartbeat);
    if (uploadedPreview && !finalized && previewPath) await client.storage.from("uploads").remove([previewPath]);
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("document_worker_not_configured");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  do {
    try {
      await recoverStale(client);
      const row = await claim(client);
      if (row) await processOne(client, row);
      else if (!process.argv.includes("--once")) await sleep(POLL_MS);
    } catch {
      console.error("document worker job failed");
      if (!process.argv.includes("--once")) await sleep(POLL_MS);
    }
  } while (!process.argv.includes("--once"));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
