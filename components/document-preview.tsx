"use client";

import { useEffect, useRef, useState } from "react";
import { PdfDocumentPreview } from "./pdf-document-preview";

type Preview = { name: string; status: "ready" | "processing" | "failed"; mime?: string; url?: string; message?: string };

/** Private, in-app viewer shared by chat attachments and course resources. */
export function DocumentPreview({ fileId, onClose }: { fileId: string | null; onClose: () => void }) {
  return fileId ? <PreviewContent key={fileId} fileId={fileId} onClose={onClose} /> : null;
}

function PreviewContent({ fileId, onClose }: { fileId: string; onClose: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const load = async () => {
      try {
        const response = await fetch(`/api/files/${fileId}/preview`, { cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 404 ? "This file is no longer available." : "Could not open this file.");
        const result = await response.json() as Preview;
        if (alive) {
          setPreview(result); setError("");
          if (result.status === "processing") timer = window.setTimeout(() => { void load(); }, 5_000);
        }
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : "Could not open this file.");
      }
    };
    void load();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [fileId]);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled),a[href]") ?? []);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);
  const download = async () => {
    const response = await fetch(`/api/files/${fileId}`);
    if (!response.ok) { setError("Could not download this file."); return; }
    const { url, name } = await response.json() as { url: string; name: string };
    const link = document.createElement("a");
    const target = new URL(url);
    target.searchParams.set("download", name);
    link.href = target.toString();
    link.rel = "noopener noreferrer";
    document.body.appendChild(link); link.click(); link.remove();
  };
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-surface-000/75 p-2 backdrop-blur-sm sm:p-5">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={preview?.name ? `Preview ${preview.name}` : "Document preview"}
      className="flex h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line bg-surface-100 text-ink shadow-menu sm:h-[min(92dvh,1040px)]">
      <header className="flex min-h-16 items-center gap-3 border-b border-line px-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">Document preview</p>
          <h2 className="truncate text-sm font-semibold sm:text-base">{preview?.name ?? "Opening file…"}</h2>
        </div>
        <button type="button" className="rounded-full border border-line px-3 py-1.5 text-sm hover:bg-surface-200" onClick={() => void download()}>Download</button>
        <button ref={closeRef} type="button" className="rounded-full border border-line px-3 py-1.5 text-sm hover:bg-surface-200" onClick={onClose} aria-label="Close document preview">Close</button>
      </header>
      {error ? <div role="alert" className="m-auto max-w-md p-6 text-center text-sm">{error}</div>
        : preview?.status === "ready" && preview.url ? preview.mime?.startsWith("image/")
          // Private signed images must load directly from Storage; an image proxy would duplicate the full file.
          // eslint-disable-next-line @next/next/no-img-element
          ? <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4"><img src={preview.url} alt={preview.name} className="max-h-full max-w-full object-contain" /></div>
          : <PdfDocumentPreview url={preview.url} name={preview.name} />
        : <div role={preview?.status === "failed" ? "alert" : "status"} className="m-auto max-w-md p-6 text-center text-sm">
          {preview?.status !== "failed" && <span className="mx-auto mb-4 block h-7 w-7 animate-spin rounded-full border-2 border-brand border-t-transparent" />}
          <p>{preview?.message ?? "Opening document…"}</p>
        </div>}
    </section>
  </div>;
}
