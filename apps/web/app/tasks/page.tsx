"use client";
import { useEffect, useState } from "react";
const API = process.env.NEXT_PUBLIC_API!;
const TOK = "local-dev-token"; // M6: swap for session token
const H = { Authorization: `Bearer ${TOK}` };

type Task = { id: string; title: string; state: string; dept: string; dept_label: string; assignee_name: string | null };
const COLUMNS = ["open", "doing", "done"] as const;

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");

  const load = () => fetch(`${API}/api/v1/tasks`, { headers: H }).then(r => r.json()).then(j => setTasks(j.tasks ?? []));
  useEffect(() => { load(); }, []);

  const addTask = async () => {
    if (!title.trim()) return;
    await fetch(`${API}/api/v1/tasks`, {
      method: "POST", headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    setTitle(""); load();
  };
  const move = async (id: string, state: string) => {
    await fetch(`${API}/api/v1/tasks/${id}`, {
      method: "PATCH", headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    load();
  };

  return (
    <main className="gridbg min-h-screen p-6 space-y-4">
      <header>
        <div className="text-xs text-zinc-500 tracking-widest">// WORK MANAGEMENT</div>
        <h1 className="neon text-3xl font-bold mt-1">TASKS</h1>
      </header>

      <div className="flex gap-2 max-w-xl">
        <input value={title} onChange={e => setTitle(e.target.value)}
               onKeyDown={e => e.key === "Enter" && addTask()}
               placeholder="new task..." className="flex-1 bg-black/40 border border-zinc-600 px-3 py-2 text-sm" />
        <button onClick={addTask} className="px-3 py-2 border border-zinc-600 text-sm">Add</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {COLUMNS.map(col => (
          <div key={col} className="border border-[var(--line)] bg-black/20 p-3">
            <div className="text-[10px] tracking-widest text-zinc-500 uppercase mb-2">
              {col} <span className="text-zinc-300">{tasks.filter(t => t.state === col).length}</span>
            </div>
            <div className="space-y-2">
              {tasks.filter(t => t.state === col).map(t => (
                <div key={t.id} className="border border-[var(--line)] p-2 text-sm">
                  <div>{t.title}</div>
                  <div className="text-[9px] text-zinc-500 mt-1">{t.dept_label}{t.assignee_name ? ` · ${t.assignee_name}` : ""}</div>
                  <div className="flex gap-1 mt-2">
                    {COLUMNS.filter(c => c !== col).map(c => (
                      <button key={c} onClick={() => move(t.id, c)}
                              className="text-[9px] px-1.5 py-0.5 border border-zinc-700 hover:border-zinc-400">
                        → {c}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
