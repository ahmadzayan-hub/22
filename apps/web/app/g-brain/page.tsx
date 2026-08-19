"use client";
import { useEffect, useMemo, useState } from "react";
const API = process.env.NEXT_PUBLIC_API!;
const TOK = "local-dev-token"; // M6: swap for session token
type N = { id: string; type: string; label: string; color?: string; x?: number; y?: number; slug?: string };
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function Page() {
  const [view, setView] = useState<"radial" | "neural">("radial");
  const [dept, setDept] = useState<string | null>(null);
  const [data, setData] = useState<{ nodes: N[]; links: any[] } | null>(null);
  useEffect(() => {
    const url = dept ? `${API}/api/v1/gbrain/depts/${dept}/subgraph`
                     : `${API}/api/v1/gbrain/graph?view=${view}`;
    fetch(url, { headers: { Authorization: `Bearer ${TOK}` } }).then(r => r.json()).then(setData);
  }, [view, dept]);
  return (
    <main className="gridbg min-h-screen p-6">
      <header className="flex items-center gap-3 mb-4">
        <h1 className="neon text-2xl font-bold">G-BRAIN</h1>
        <span className="text-xs text-zinc-500">// KNOWLEDGE CORE</span>
        <button className="px-2 border border-zinc-600" onClick={() => { setDept(null); setView("radial"); }}>Radial</button>
        <button className="px-2 border border-zinc-600" onClick={() => { setDept(null); setView("neural"); }}>Neural</button>
        {dept && <button className="px-2 border border-red-500 text-red-400" onClick={() => setDept(null)}>← Back</button>}
      </header>
      <IngestBar />
      {data && <Graph data={data} onDept={(s?: string) => s && setDept(s)} />}
    </main>);
}

function IngestBar() {
  const [txt, setTxt] = useState("");
  const post = (fd: FormData) => fetch(`${API}/api/v1/gbrain/ingest`,
    { method: "POST", body: fd, headers: { Authorization: `Bearer ${TOK}` } }).then(r => r.json())
    .then(j => alert(JSON.stringify(j)));
  return (
    <div className="mb-4 flex gap-2 max-w-3xl">
      <input value={txt} onChange={e => setTxt(e.target.value)}
        placeholder="dump into the brain... or drop documents · text · voice · drag or upload"
        className="flex-1 bg-black/40 border border-zinc-600 px-3 py-2"
        onKeyDown={e => { if (e.key === "Enter" && txt) { const fd = new FormData(); fd.append("text", txt); post(fd); setTxt(""); } }} />
      <label className="px-3 py-2 border border-zinc-600 cursor-pointer">upload
        <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { const fd = new FormData(); fd.append("file", f); post(fd); } }} /></label>
      <label className="px-3 py-2 border border-zinc-600 cursor-pointer">voice
        <input type="file" accept="audio/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { const fd = new FormData(); fd.append("audio", f); post(fd); } }} /></label>
    </div>);
}

function Graph({ data, onDept }: { data: { nodes: N[]; links: any[] }; onDept: (s?: string) => void }) {
  const W = 1000, S = 118;
  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    const hasXY = data.nodes.some((n) => n.x !== undefined);
    if (hasXY) data.nodes.forEach(n => m.set(n.id, { x: W / 2 + (n.x ?? 0) * S, y: W / 2 + (n.y ?? 0) * S }));
    else { // subgraph fan-out: tools → agents → notes → hub
      const row: Record<string, number> = { tool: 120, agent: 330, note: 540, dept: 760 };
      const by: Record<string, N[]> = {};
      data.nodes.forEach(n => (by[n.type] ??= []).push(n));
      Object.entries(by).forEach(([t, list]) =>
        list.forEach((n, i) => m.set(n.id, { x: (W / (list.length + 1)) * (i + 1), y: row[t] ?? 450 })));
    }
    return m;
  }, [data]);
  return (
    <svg viewBox={`0 0 ${W} ${W}`} className="w-full max-w-[920px] mx-auto">
      {data.links.map((l, i) => { const a = pos.get(l.src), b = pos.get(l.dst);
        return a && b ? <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#39424a" strokeWidth={0.6} strokeDasharray={l.kind === "references" ? "3 3" : undefined} /> : null; })}
      {data.nodes.map(n => { const p = pos.get(n.id); if (!p) return null;
        const r = n.type === "dept" ? 26 : n.type === "agent" ? 14 : n.type === "tool" ? 11 : 6;
        return (
          <g key={n.id} className={n.type === "dept" ? "cursor-pointer" : ""}
             onClick={() => n.type === "dept" && onDept(n.slug ?? slugify(n.label))}>
            <circle cx={p.x} cy={p.y} r={r} fill="#0b0e10" stroke={n.color ?? "#e8e8e8"} strokeWidth={2}
                    style={{ filter: `drop-shadow(0 0 6px ${n.color ?? "#ffffff"})` }} />
            {(n.type === "dept" || n.type === "agent") &&
              <text x={p.x} y={p.y + r + 15} textAnchor="middle" fontSize={12} fill={n.color ?? "#ddd"}>{n.label}</text>}
          </g>); })}
    </svg>);
}
