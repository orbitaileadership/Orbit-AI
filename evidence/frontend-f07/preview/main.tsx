import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../../app/globals.css";
import { SourceList, type Source } from "../../../components/answer-text";
import { SourceList as Before } from "../AnswerTextBefore";
import fixtures from "../student/fixtures.json";
const before = new URLSearchParams(location.search).get("version") === "before";
const Component = before ? Before : SourceList;
document.documentElement.dataset.color = "dark";
function Preview() {
  const [light, setLight] = useState(false);
  const [sources, setSources] = useState<Source[]>(fixtures.sources as Source[]);
  const [packet, setPacket] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  return <main className="mx-auto max-w-3xl space-y-4 p-5 text-ink">
    <p className="font-semibold text-warning">MOCK / OFFLINE — synthetic source passages. No AI answer or provider request.</p>
    <h1 className="text-xl font-semibold">Check a source passage · {before ? "Before" : "After"}</h1>
    <p className="text-sm text-ink-muted">Open each supplied fictional source to inspect its label and exact excerpt. No file is uploaded or fetched. Links are synthetic and must not be opened.</p>
    <button type="button" className="min-h-11 rounded-lg border border-line px-3 text-sm" onClick={() => { const next = !light; setLight(next); document.documentElement.dataset.color = next ? "light" : "dark"; }}>Toggle light fixture</button>
    <details><summary>Transient reviewer fixture · memory only</summary><label className="block">Synthetic sources JSON<textarea aria-label="Synthetic sources JSON" className="block w-full border border-line" value={packet} onChange={(e) => setPacket(e.target.value)} /></label><button type="button" onClick={() => { try { const parsed = JSON.parse(packet); if (!Array.isArray(parsed.sources)) throw new Error(); setSources(parsed.sources); setRevision(revision + 1); setError(""); } catch { setError("Provide a sources array."); } }}>Load fixture</button><p role="status">{error}</p></details>
    <section aria-label="Synthetic source list" className="rounded-xl border border-line p-4">
      <Component key={revision} sources={sources} />
    </section>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
