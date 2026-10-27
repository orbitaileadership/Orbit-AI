"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";

/** Render private PDFs in Orbit without relying on a browser PDF plug-in. */
export function PdfDocumentPreview({ url, name }: { url: string; name: string }) {
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState(0);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => setWidth(Math.max(0, Math.floor(container.clientWidth - 32)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;
    documentRef.current = null;

    const load = async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      if (cancelled) return;
      task = pdfjs.getDocument({
        url,
        rangeChunkSize: 128 * 1024,
        disableStream: true,
        disableAutoFetch: true,
      });
      const document = await task.promise;
      if (cancelled) return;
      documentRef.current = document;
      setPages(document.numPages);
    };
    void load().catch(() => {
      if (!cancelled) setError("Could not render this PDF. Close and reopen it to refresh the link, or download the original.");
    });
    return () => {
      cancelled = true;
      documentRef.current = null;
      if (task) void task.destroy();
    };
  }, [url]);

  useEffect(() => {
    const document = documentRef.current;
    const canvas = canvasRef.current;
    if (!document || !canvas || !pages || !width) return;
    let cancelled = false;
    let task: RenderTask | null = null;

    const draw = async () => {
      const pdfPage = await document.getPage(page);
      if (cancelled) return;
      setRendered(false);
      setError("");
      const base = pdfPage.getViewport({ scale: 1 });
      const cssScale = Math.min(Math.min(width, 1200) / base.width, 2);
      const pixels = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(16_000_000 / (base.width * base.height * cssScale * cssScale)));
      const viewport = pdfPage.getViewport({ scale: cssScale * pixels });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.style.width = `${Math.ceil(viewport.width / pixels)}px`;
      canvas.style.height = `${Math.ceil(viewport.height / pixels)}px`;
      task = pdfPage.render({ canvas, viewport });
      await task.promise;
      if (!cancelled) setRendered(true);
    };
    void draw().catch((cause: unknown) => {
      if (!cancelled && !(cause instanceof Error && cause.name === "RenderingCancelledException")) {
        setError("Could not draw this page. Try another page or download the original.");
      }
    });
    return () => { cancelled = true; task?.cancel(); };
  }, [page, pages, width]);

  return <div className="flex min-h-0 flex-1 flex-col" aria-label={`PDF preview for ${name}`}>
    <div className="flex min-h-12 items-center justify-center gap-3 border-b border-line bg-surface-100 px-3 text-sm">
      <button type="button" className="rounded-lg border border-line px-3 py-1 disabled:opacity-40" onClick={() => { setRendered(false); setPage(value => value - 1); }} disabled={page <= 1 || !pages}>Previous</button>
      <span aria-live="polite">{pages ? `Page ${page} of ${pages}` : "Loading PDF…"}</span>
      <button type="button" className="rounded-lg border border-line px-3 py-1 disabled:opacity-40" onClick={() => { setRendered(false); setPage(value => value + 1); }} disabled={page >= pages || !pages}>Next</button>
    </div>
    <div ref={containerRef} className="relative min-h-0 flex-1 overflow-auto bg-surface-200 p-4 text-center">
      {error ? <p role="alert" className="mx-auto mt-10 max-w-md rounded-xl border border-line bg-surface-100 p-4">{error}</p> : !rendered && <p role="status" className="mt-10 text-sm text-ink-muted">Rendering page {page}…</p>}
      <canvas key={page} ref={canvasRef} role="img" aria-label={`${name}, page ${page}`} className={`mx-auto bg-white shadow-menu ${rendered && !error ? "block" : "hidden"}`} />
    </div>
  </div>;
}
