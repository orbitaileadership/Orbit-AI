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
  const closeRef = useRef<HTMLButtonElement>(null);
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
    closeRef.current?.focus();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [fileId]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [fileId, onClose]);
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
  return <div className="fixed inset-0 z-[80] flex flex-col bg-surface-000/95 text-ink" role="dialog" aria-modal="true" aria-label={preview?.name ? `Preview ${preview.name}` : "Document preview"}>
    <header className="flex min-h-16 items-center gap-3 border-b border-line bg-surface-100 px-3 sm:px-5">
      <h2 className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">{preview?.name ?? "Opening file…"}</h2>
      <button type="button" className="rounded-full border border-line px-3 py-1.5 text-sm hover:bg-surface-200" onClick={() => void download()}>Download</button>
      <button ref={closeRef} type="button" className="rounded-full border border-line px-3 py-1.5 text-sm hover:bg-surface-200" onClick={onClose} aria-label="Close document preview">Close</button>
    </header>
    {error ? <div role="alert" className="m-auto rounded-2xl border border-line bg-surface-100 p-6">{error}</div>
      : preview?.status === "ready" && preview.url ? preview.mime?.startsWith("image/")
        // Private signed images must load directly from Storage; an image proxy would duplicate the full file.
        // eslint-disable-next-line @next/next/no-img-element
        ? <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4"><img src={preview.url} alt={preview.name} className="max-h-full max-w-full object-contain" /></div>
        : <PdfDocumentPreview url={preview.url} name={preview.name} />
      : <div role={preview?.status === "failed" ? "alert" : "status"} className="m-auto max-w-md rounded-2xl border border-line bg-surface-100 p-6 text-center">
        {preview?.status !== "failed" && <span className="mx-auto mb-4 block h-7 w-7 animate-spin rounded-full border-2 border-brand border-t-transparent" />}
        <p>{preview?.message ?? "Opening document…"}</p>
      </div>}
  </div>;
}
