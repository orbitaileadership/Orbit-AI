"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";

/** Render the original private PDF as a vertically scrolling, lazily drawn document. */
export function PdfDocumentPreview({ url, name }: { url: string; name: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [width, setWidth] = useState(0);
  const [firstPageRatio, setFirstPageRatio] = useState(11 / 8.5);
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
      const loaded = await task.promise;
      if (cancelled) return;
      const first = await loaded.getPage(1);
      if (cancelled) return;
      const size = first.getViewport({ scale: 1 });
      setFirstPageRatio(size.height / size.width);
      setDocument(loaded);
    };
    void load().catch(() => {
      if (!cancelled) setError("Could not render this PDF. Close and reopen it to refresh the link, or download the original.");
    });
    return () => { cancelled = true; if (task) void task.destroy(); };
  }, [url]);

  return <div className="flex min-h-0 flex-1 flex-col" aria-label={`PDF preview for ${name}`}>
    <div className="flex min-h-11 items-center justify-center border-b border-line px-3 text-xs text-ink-muted">
      {document ? `${document.numPages} ${document.numPages === 1 ? "page" : "pages"} · Scroll to read` : "Loading PDF…"}
    </div>
    <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface-200 p-4">
      {error ? <p role="alert" className="mx-auto mt-10 max-w-md rounded-xl border border-line bg-surface-100 p-4 text-center text-sm">{error}</p>
        : document ? <div className="mx-auto flex max-w-[1200px] flex-col gap-5">
          {Array.from({ length: document.numPages }, (_, index) => <PdfPage key={index + 1} document={document} pageNumber={index + 1}
            pageCount={document.numPages} width={width} firstPageRatio={firstPageRatio} scrollRootRef={containerRef} name={name} />)}
        </div> : <p role="status" className="mt-10 text-center text-sm text-ink-muted">Opening PDF…</p>}
    </div>
  </div>;
}

function PdfPage({ document, pageNumber, pageCount, width, firstPageRatio, scrollRootRef, name }: {
  document: PDFDocumentProxy;
  pageNumber: number;
  pageCount: number;
  width: number;
  firstPageRatio: number;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  name: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState("");
  const [pageRatio, setPageRatio] = useState<number | null>(null);
  const [maxWidth, setMaxWidth] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    const root = scrollRootRef.current;
    if (!host || !root) return;
    if (!("IntersectionObserver" in window)) {
      const frame = requestAnimationFrame(() => setNear(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting;
      setNear(visible);
      if (!visible) {
        setRendered(false);
        const canvas = canvasRef.current;
        if (canvas) { canvas.width = 0; canvas.height = 0; }
      }
    }, { root, rootMargin: "500px 0px" });
    observer.observe(host);
    return () => observer.disconnect();
  }, [scrollRootRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!near || !width || !canvas) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    const draw = async () => {
      const page = await document.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      setPageRatio(base.height / base.width);
      setMaxWidth(base.width * 2);
      setRendered(false);
      setError("");
      const cssScale = Math.min(Math.min(width, 1200) / base.width, 2);
      const pixels = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(16_000_000 / (base.width * base.height * cssScale * cssScale)));
      const viewport = page.getViewport({ scale: cssScale * pixels });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.style.width = `${Math.ceil(viewport.width / pixels)}px`;
      canvas.style.height = `${Math.ceil(viewport.height / pixels)}px`;
      task = page.render({ canvas, viewport });
      await task.promise;
      if (!cancelled) setRendered(true);
    };
    void draw().catch((cause: unknown) => {
      if (!cancelled && !(cause instanceof Error && cause.name === "RenderingCancelledException")) {
        setError(`Could not draw page ${pageNumber}. Close and reopen the PDF, or download the original.`);
      }
    });
    return () => { cancelled = true; task?.cancel(); };
  }, [attempt, document, near, pageNumber, width]);

  const cssWidth = Math.min(width || 680, maxWidth ?? 1200);
  const height = Math.ceil(cssWidth * (pageRatio ?? firstPageRatio));
  return <div ref={hostRef} aria-label={`Page ${pageNumber} of ${pageCount}`}
    className="relative mx-auto w-full bg-white shadow-menu" style={{ height }}>
    <canvas ref={canvasRef} role="img" aria-label={`${name}, page ${pageNumber}`}
      className={`mx-auto bg-white ${near && rendered && !error ? "block" : "hidden"}`} />
    {near && error ? <div role="alert" className="absolute inset-0 grid place-content-center gap-3 p-4 text-center text-sm text-ink">
      <p>{error}</p><button type="button" className="mx-auto rounded-lg border border-line px-3 py-1.5" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Retry page</button>
    </div> : !rendered && <div role="status" className="absolute inset-0 grid place-items-center text-xs text-ink-subtle">Page {pageNumber}</div>}
  </div>;
}
