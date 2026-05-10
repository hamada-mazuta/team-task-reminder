import { useState, useEffect, useRef } from "react";

const ADMIN_NAME = "admin";
const MEMBERS = ["admin", "Aku", "Budi", "Sari", "Dani", "Rizky"];
const STATUS_LIST = ["Belum", "Dikerjakan", "Selesai"];
const STATUS_COLOR = {
  "Belum": { bg: "#FCEBEB", text: "#A32D2D", border: "#F09595" },
  "Dikerjakan": { bg: "#FAEEDA", text: "#854F0B", border: "#EF9F27" },
  "Selesai": { bg: "#EAF3DE", text: "#3B6D11", border: "#97C459" },
};
const PRIORITY_COLOR = {
  "Tinggi": { bg: "#FCEBEB", text: "#A32D2D" },
  "Sedang": { bg: "#FAEEDA", text: "#854F0B" },
  "Rendah": { bg: "#EAF3DE", text: "#3B6D11" },
};

const STORAGE_KEY = "team_tasks_v2";

function isAdmin(name) {
  return name?.toLowerCase() === ADMIN_NAME.toLowerCase();
}

function canEdit(task, currentUser) {
  return isAdmin(currentUser) || task.creator === currentUser || task.assignee === currentUser;
}

function canDelete(task, currentUser) {
  return isAdmin(currentUser) || task.creator === currentUser;
}

function initials(name) {
  return name.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = {
  "admin": { bg: "#1a1a18", text: "#ffffff" },
  "Aku": { bg: "#EEEDFE", text: "#3C3489" },
  "Budi": { bg: "#E1F5EE", text: "#085041" },
  "Sari": { bg: "#FBEAF0", text: "#72243E" },
  "Dani": { bg: "#FAEEDA", text: "#633806" },
  "Rizky": { bg: "#E6F1FB", text: "#0C447C" },
};

function getAvatarColor(name) {
  if (AVATAR_COLORS[name]) return AVATAR_COLORS[name];
  const colors = Object.values(AVATAR_COLORS).slice(1);
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function Avatar({ name, size = 22 }) {
  const c = getAvatarColor(name || "?");
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: c.bg, color: c.text, fontWeight: 500,
      fontSize: size * 0.42, display: "inline-flex",
      alignItems: "center", justifyContent: "center", flexShrink: 0
    }}>{initials(name || "?")}</div>
  );
}

function Badge({ label, style, icon }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: "2px 8px",
      borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 3, ...style
    }}>
      {icon && <i className={`ti ${icon}`} style={{ fontSize: 11 }} aria-hidden />}
      {label}
    </span>
  );
}

function Modal({ show, onClose, children, width = 420 }) {
  if (!show) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem"
    }} onClick={onClose}>
      <div style={{
        background: "var(--color-background-primary)",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: 16, padding: "1.5rem", width, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto"
      }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function calculateProgress(task) {
  if (!task.steps || task.steps.length === 0) return null;
  const done = task.steps.filter(s => s.done).length;
  return Math.round((done / task.steps.length) * 100);
}

function ProgressBar({ percent, height = 6 }) {
  const c = percent === 100 ? "#3B6D11" : percent >= 50 ? "#854F0B" : "#0C447C";
  return (
    <div style={{ background: "var(--color-background-secondary)", height, borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${percent}%`, height: "100%", background: c, transition: "width 0.3s" }} />
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "7px 10px", borderRadius: 8,
  border: "0.5px solid var(--color-border-secondary)",
  background: "var(--color-background-secondary)",
  color: "var(--color-text-primary)", fontSize: 14, boxSizing: "border-box"
};
const labelStyle = { fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 };
const btnPrimary = {
  background: "var(--color-text-primary)", color: "var(--color-background-primary)",
  border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 500
};
const btnSecondary = {
  background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)",
  borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, color: "var(--color-text-primary)"
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userInput, setUserInput] = useState("Aku");
  const [tasks, setTasks] = useState([]);
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [filterMember, setFilterMember] = useState("Semua");
  const [tab, setTab] = useState("tasks");
  const [showAdd, setShowAdd] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [reminderTime, setReminderTime] = useState("08:00");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [notifStatus, setNotifStatus] = useState("");
  const [newTask, setNewTask] = useState({
    title: "", assignee: "Aku", approver: "", priority: "Sedang",
    startDate: "", deadline: "", reminderDays: 1, steps: []
  });
  const [newStep, setNewStep] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("");
  const reminderRef = useRef(null);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadTasks() {
    try {
      const result = await window.storage.get(STORAGE_KEY, true);
      if (result?.value) {
        setTasks(JSON.parse(result.value));
      } else {
        const seed = [
          { id: 1, title: "Review proposal Q2", assignee: "Budi", creator: "Sari", approver: "admin", priority: "Tinggi", status: "Belum", startDate: "2026-05-10", deadline: "2026-05-12", reminderDays: 1, steps: [{ id: 1, text: "Baca dokumen", done: true }, { id: 2, text: "Beri komentar", done: false }, { id: 3, text: "Submit ke atasan", done: false }], createdAt: Date.now() },
          { id: 2, title: "Update laporan mingguan", assignee: "Sari", creator: "Aku", approver: "admin", priority: "Sedang", status: "Dikerjakan", startDate: "2026-05-09", deadline: "2026-05-13", reminderDays: 1, steps: [], createdAt: Date.now() },
        ];
        setTasks(seed);
        await window.storage.set(STORAGE_KEY, JSON.stringify(seed), true);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function saveTasks(updated) {
    setSyncStatus("Menyimpan...");
    setTasks(updated);
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(updated), true);
      setSyncStatus("Tersimpan");
      setTimeout(() => setSyncStatus(""), 1500);
    } catch {
      setSyncStatus("Gagal");
      setTimeout(() => setSyncStatus(""), 2000);
    }
  }

  function handleSetUser() {
    const name = userInput.trim();
    if (!name) return;
    setCurrentUser(name);
    setNewTask(v => ({ ...v, assignee: name }));
  }

  const filtered = tasks.filter(t =>
    (filterStatus === "Semua" || t.status === filterStatus) &&
    (filterMember === "Semua" || t.assignee === filterMember)
  );

  const counts = {
    Belum: tasks.filter(t => t.status === "Belum").length,
    Dikerjakan: tasks.filter(t => t.status === "Dikerjakan").length,
    Selesai: tasks.filter(t => t.status === "Selesai").length,
  };

  async function saveTask() {
    if (!newTask.title.trim() || !currentUser) return;
    if (editingTask) {
      const updated = tasks.map(t => t.id === editingTask.id ? { ...t, ...newTask } : t);
      await saveTasks(updated);
    } else {
      const updated = [...tasks, {
        ...newTask, id: Date.now(), status: "Belum",
        creator: currentUser, createdAt: Date.now()
      }];
      await saveTasks(updated);
    }
    closeModal();
  }

  function openEdit(task) {
    if (!canEdit(task, currentUser)) return;
    setEditingTask(task);
    setNewTask({
      title: task.title, assignee: task.assignee, approver: task.approver || "",
      priority: task.priority, startDate: task.startDate || "", deadline: task.deadline || "",
      reminderDays: task.reminderDays || 1, steps: task.steps || []
    });
    setShowAdd(true);
  }

  function closeModal() {
    setShowAdd(false);
    setEditingTask(null);
    setNewStep("");
    setNewTask({ title: "", assignee: currentUser || "Aku", approver: "", priority: "Sedang", startDate: "", deadline: "", reminderDays: 1, steps: [] });
  }

  function addStep() {
    if (!newStep.trim()) return;
    setNewTask(v => ({ ...v, steps: [...v.steps, { id: Date.now(), text: newStep, done: false }] }));
    setNewStep("");
  }

  function toggleStepInForm(id) {
    setNewTask(v => ({ ...v, steps: v.steps.map(s => s.id === id ? { ...s, done: !s.done } : s) }));
  }

  function removeStepInForm(id) {
    setNewTask(v => ({ ...v, steps: v.steps.filter(s => s.id !== id) }));
  }

  async function toggleStepInTask(taskId, stepId) {
    const updated = tasks.map(t => {
      if (t.id !== taskId) return t;
      if (!canEdit(t, currentUser)) return t;
      const steps = t.steps.map(s => s.id === stepId ? { ...s, done: !s.done } : s);
      const allDone = steps.length > 0 && steps.every(s => s.done);
      return { ...t, steps, status: allDone ? "Selesai" : (t.status === "Selesai" ? "Dikerjakan" : t.status) };
    });
    await saveTasks(updated);
  }

  async function updateStatus(id, status) {
    const t = tasks.find(x => x.id === id);
    if (!canEdit(t, currentUser)) return;
    await saveTasks(tasks.map(x => x.id === id ? { ...x, status } : x));
  }

  async function deleteTaskConfirmed() {
    if (!confirmDelete) return;
    const t = tasks.find(x => x.id === confirmDelete);
    if (!canDelete(t, currentUser)) { setConfirmDelete(null); return; }
    await saveTasks(tasks.filter(x => x.id !== confirmDelete));
    setConfirmDelete(null);
  }

  async function generateSummary() {
    setLoadingSummary(true);
    setShowSummary(true);
    setSummary("");
    const today = new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const pending = tasks.filter(t => t.status !== "Selesai");
    const myTasks = pending.filter(t => t.assignee === currentUser);
    const prompt = `Kamu asisten produktivitas tim. Hari ini ${today}. Berbicara dengan ${currentUser}${isAdmin(currentUser) ? " (admin)" : ""}.

Tugas tim belum selesai:
${pending.map(t => {
  const p = calculateProgress(t);
  return `- [${t.priority}] ${t.title} (Pemilik: ${t.creator}, Assignee: ${t.assignee}, Approver: ${t.approver || "-"}, Deadline: ${t.deadline || "-"}, Status: ${t.status}${p !== null ? `, Progress: ${p}%` : ""})`;
}).join("\n")}

Tugas ${currentUser}:
${myTasks.length > 0 ? myTasks.map(t => `- ${t.title}`).join("\n") : "(tidak ada)"}

Buat rangkuman Bahasa Indonesia: sapa ${currentUser} personal, highlight prioritas tinggi & deadline dekat, beri rekomendasi fokus, kondisi tim. Format poin pendek, maks 200 kata.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] })
      });
      const data = await res.json();
      setSummary(data.content?.find(b => b.type === "text")?.text || "Gagal.");
    } catch { setSummary("Gagal menghubungi AI."); }
    setLoadingSummary(false);
  }

  function scheduleReminder() {
    if (!reminderEnabled) { setNotifStatus("Pengingat dimatikan."); return; }
    if (!("Notification" in window)) { setNotifStatus("Browser tidak mendukung notifikasi."); return; }
    Notification.requestPermission().then(perm => {
      if (perm !== "granted") { setNotifStatus("Izin notifikasi ditolak."); return; }
      const [h, m] = reminderTime.split(":").map(Number);
      const now = new Date(), target = new Date();
      target.setHours(h, m, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      const ms = target - now;
      clearTimeout(reminderRef.current);
      reminderRef.current = setTimeout(() => {
        const myPending = tasks.filter(t => t.assignee === currentUser && t.status !== "Selesai").length;
        new Notification("Pengingat Tugas Tim", { body: `Halo ${currentUser}! Ada ${myPending} tugasmu yang belum selesai.` });
      }, ms);
      const mins = Math.round(ms / 60000);
      setNotifStatus(`Aktif — muncul dalam ${mins > 60 ? Math.round(mins / 60) + " jam" : mins + " menit"}.`);
    });
  }

  // Statistics
  const stats = {
    total: tasks.length,
    selesai: counts.Selesai,
    dikerjakan: counts.Dikerjakan,
    belum: counts.Belum,
    completionRate: tasks.length > 0 ? Math.round((counts.Selesai / tasks.length) * 100) : 0,
    perMember: {},
    overdue: 0,
    today: 0,
  };
  const todayStr = new Date().toISOString().split("T")[0];
  tasks.forEach(t => {
    if (!stats.perMember[t.assignee]) stats.perMember[t.assignee] = { total: 0, done: 0 };
    stats.perMember[t.assignee].total++;
    if (t.status === "Selesai") stats.perMember[t.assignee].done++;
    if (t.deadline && t.deadline < todayStr && t.status !== "Selesai") stats.overdue++;
    if (t.deadline === todayStr && t.status !== "Selesai") stats.today++;
  });

  // LOGIN SCREEN
  if (!currentUser) {
    return (
      <div style={{ maxWidth: 400, margin: "3rem auto", padding: "0 1rem", fontFamily: "var(--font-sans)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 6 }}>
          <i className="ti ti-checklist" style={{ marginRight: 8 }} aria-hidden />Team Task Reminder
        </h2>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>
          Masukkan namamu. Ketik <code style={{ background: "var(--color-background-secondary)", padding: "1px 6px", borderRadius: 4 }}>admin</code> untuk akses superpower.
        </p>
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
          <label style={labelStyle}>Nama kamu</label>
          <input value={userInput} onChange={e => setUserInput(e.target.value)} list="member-list"
            onKeyDown={e => e.key === "Enter" && handleSetUser()}
            style={{ ...inputStyle, marginBottom: 12 }} />
          <datalist id="member-list">{MEMBERS.map(m => <option key={m} value={m} />)}</datalist>
          <button onClick={handleSetUser} style={{ ...btnPrimary, width: "100%", padding: "9px 18px", fontSize: 14 }}>Masuk</button>
        </div>
      </div>
    );
  }

  if (loading) return <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-text-secondary)" }}>Memuat...</div>;

  const admin = isAdmin(currentUser);

  return (
    <div style={{ padding: "1rem 0", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>
          <i className="ti ti-checklist" style={{ marginRight: 8 }} aria-hidden />Team Task Reminder
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {syncStatus && <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{syncStatus}</span>}
          <button onClick={() => setCurrentUser(null)} style={{
            display: "flex", alignItems: "center", gap: 6, background: admin ? "#1a1a18" : "var(--color-background-secondary)",
            color: admin ? "#fff" : "var(--color-text-secondary)",
            border: "0.5px solid var(--color-border-tertiary)", borderRadius: 999, padding: "4px 10px 4px 4px",
            cursor: "pointer", fontSize: 12
          }}>
            <Avatar name={currentUser} size={22} />
            {currentUser}
            {admin && <i className="ti ti-shield-check" style={{ fontSize: 13, marginLeft: 2 }} aria-hidden />}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: "1.25rem" }}>
        {[["Belum","#FCEBEB","#A32D2D"],["Dikerjakan","#FAEEDA","#854F0B"],["Selesai","#EAF3DE","#3B6D11"]].map(([s,bg,c]) => (
          <div key={s} onClick={() => setFilterStatus(filterStatus === s ? "Semua" : s)}
            style={{ background: bg, borderRadius: 10, padding: "10px 14px", cursor: "pointer", border: filterStatus === s ? `1.5px solid ${c}` : "1.5px solid transparent" }}>
            <div style={{ fontSize: 11, color: c, fontWeight: 500 }}>{s}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: c }}>{counts[s]}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: "1rem", overflowX: "auto" }}>
        {[["tasks","ti-layout-list","Tugas"],["stats","ti-chart-bar","Statistik"],["summary","ti-sparkles","AI"],["settings","ti-settings","Pengingat"]].map(([t,icon,label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: "none", border: "none", padding: "8px 14px", cursor: "pointer", fontSize: 13,
            fontWeight: tab === t ? 500 : 400, whiteSpace: "nowrap",
            color: tab === t ? "var(--color-text-primary)" : "var(--color-text-secondary)",
            borderBottom: tab === t ? "2px solid var(--color-text-primary)" : "2px solid transparent",
          }}>
            <i className={`ti ${icon}`} style={{ marginRight: 5, fontSize: 14 }} aria-hidden />{label}
          </button>
        ))}
      </div>

      {/* TASKS TAB */}
      {tab === "tasks" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <select value={filterMember} onChange={e => setFilterMember(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 10px" }}>
              <option>Semua</option>
              {[...new Set([...MEMBERS, ...tasks.map(t => t.assignee)])].map(m => <option key={m}>{m}</option>)}
            </select>
            <button onClick={loadTasks} style={{ ...btnSecondary, padding: "6px 10px" }}><i className="ti ti-refresh" style={{ fontSize: 14 }} aria-hidden /></button>
            <div style={{ flex: 1 }} />
            <button onClick={() => { setNewTask(v => ({ ...v, assignee: currentUser })); setShowAdd(true); }} style={{ ...btnPrimary, padding: "7px 14px" }}>
              <i className="ti ti-plus" style={{ marginRight: 5, fontSize: 14 }} aria-hidden />Tambah Tugas
            </button>
          </div>

          {filtered.length === 0 && <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-secondary)", fontSize: 14 }}>Tidak ada tugas.</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(t => {
              const progress = calculateProgress(t);
              const editable = canEdit(t, currentUser);
              const deletable = canDelete(t, currentUser);
              const isOverdue = t.deadline && t.deadline < todayStr && t.status !== "Selesai";

              return (
                <div key={t.id} style={{
                  background: "var(--color-background-primary)",
                  border: `0.5px solid ${isOverdue ? "#F09595" : "var(--color-border-tertiary)"}`,
                  borderRadius: 12, padding: "12px 14px",
                  opacity: t.status === "Selesai" ? 0.7 : 1
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 8, textDecoration: t.status === "Selesai" ? "line-through" : "none" }}>
                        {t.title}
                        {isOverdue && <Badge label="Terlambat" icon="ti-alert-triangle" style={{ background: "#FCEBEB", color: "#A32D2D", marginLeft: 8 }} />}
                      </div>

                      {progress !== null && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 3 }}>
                            <span>Progress</span><span style={{ fontWeight: 500 }}>{progress}%</span>
                          </div>
                          <ProgressBar percent={progress} />
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <Badge label={t.priority} icon="ti-flag" style={{ background: PRIORITY_COLOR[t.priority].bg, color: PRIORITY_COLOR[t.priority].text }} />
                        {[["pemilik", t.creator], ["kerjakan", t.assignee], ...(t.approver ? [["approver", t.approver]] : [])].map(([role, name]) => (
                          <span key={role} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--color-background-secondary)", borderRadius: 999, padding: "2px 8px 2px 3px", fontSize: 11, color: "var(--color-text-secondary)" }}>
                            <Avatar name={name || "?"} size={16} />
                            <span style={{ fontWeight: 500 }}>{name}</span>
                            <span style={{ color: "var(--color-text-tertiary)", fontSize: 10 }}>{role}</span>
                          </span>
                        ))}
                        {t.startDate && <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <i className="ti ti-player-play" style={{ fontSize: 11 }} aria-hidden />{t.startDate}
                        </span>}
                        {t.deadline && <span style={{ fontSize: 11, color: isOverdue ? "#A32D2D" : "var(--color-text-tertiary)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <i className="ti ti-calendar" style={{ fontSize: 11 }} aria-hidden />{t.deadline}
                        </span>}
                      </div>

                      {/* Steps checklist */}
                      {t.steps && t.steps.length > 0 && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                          {t.steps.map(s => (
                            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 13 }}>
                              <input type="checkbox" checked={s.done} onChange={() => toggleStepInTask(t.id, s.id)} disabled={!editable}
                                style={{ width: 14, height: 14, cursor: editable ? "pointer" : "not-allowed" }} />
                              <span style={{ textDecoration: s.done ? "line-through" : "none", color: s.done ? "var(--color-text-tertiary)" : "var(--color-text-primary)" }}>{s.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                      <select value={t.status} onChange={e => updateStatus(t.id, e.target.value)} disabled={!editable}
                        style={{ fontSize: 11, padding: "3px 7px", borderRadius: 6, border: `0.5px solid ${STATUS_COLOR[t.status].border}`, background: STATUS_COLOR[t.status].bg, color: STATUS_COLOR[t.status].text, cursor: editable ? "pointer" : "not-allowed" }}>
                        {STATUS_LIST.map(s => <option key={s}>{s}</option>)}
                      </select>
                      <div style={{ display: "flex", gap: 4 }}>
                        {editable && (
                          <button onClick={() => openEdit(t)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", padding: 2, fontSize: 13 }} aria-label="Edit">
                            <i className="ti ti-edit" />
                          </button>
                        )}
                        {deletable && (
                          <button onClick={() => setConfirmDelete(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", padding: 2, fontSize: 13 }} aria-label="Hapus">
                            <i className="ti ti-trash" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* STATISTICS TAB */}
      {tab === "stats" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Total Tugas</div>
              <div style={{ fontSize: 24, fontWeight: 500 }}>{stats.total}</div>
            </div>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Tingkat Selesai</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: "#3B6D11" }}>{stats.completionRate}%</div>
            </div>
            <div style={{ background: "#FAEEDA", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "#854F0B" }}>Deadline Hari Ini</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: "#854F0B" }}>{stats.today}</div>
            </div>
            <div style={{ background: "#FCEBEB", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "#A32D2D" }}>Terlambat</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: "#A32D2D" }}>{stats.overdue}</div>
            </div>
          </div>

          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1rem 1.25rem" }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 12px" }}>Distribusi Status</h3>
            <div style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
              {["Belum", "Dikerjakan", "Selesai"].map(s => {
                const w = stats.total > 0 ? (counts[s] / stats.total) * 100 : 0;
                return w > 0 ? <div key={s} style={{ width: `${w}%`, background: STATUS_COLOR[s].bg, color: STATUS_COLOR[s].text, fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>{counts[s]}</div> : null;
              })}
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 11, flexWrap: "wrap" }}>
              {["Belum", "Dikerjakan", "Selesai"].map(s => (
                <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COLOR[s].bg, border: `0.5px solid ${STATUS_COLOR[s].border}` }} />
                  {s}: {counts[s]}
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1rem 1.25rem" }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 12px" }}>Performa per Anggota</h3>
            {Object.entries(stats.perMember).sort((a, b) => b[1].total - a[1].total).map(([name, d]) => {
              const pct = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
              return (
                <div key={name} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                      <Avatar name={name} size={20} />{name}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{d.done}/{d.total} • {pct}%</span>
                  </div>
                  <ProgressBar percent={pct} height={6} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUMMARY TAB */}
      {tab === "summary" && (
        <div>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: "1rem" }}>AI akan merangkum tugas untuk {currentUser}.</p>
          <button onClick={generateSummary} disabled={loadingSummary} style={{ ...btnPrimary, padding: "9px 18px", fontSize: 14, marginBottom: "1.25rem" }}>
            <i className="ti ti-sparkles" style={{ marginRight: 6 }} aria-hidden />{loadingSummary ? "Sedang merangkum..." : "Rangkum Sekarang"}
          </button>
          {showSummary && (
            <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1rem 1.25rem" }}>
              {loadingSummary ? <span style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>Menghubungi AI...</span>
                : <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{summary}</div>}
            </div>
          )}
        </div>
      )}

      {/* SETTINGS TAB */}
      {tab === "settings" && (
        <div style={{ maxWidth: 360 }}>
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>Aktifkan Pengingat</span>
              <div onClick={() => setReminderEnabled(v => !v)} style={{ width: 42, height: 24, borderRadius: 999, cursor: "pointer", background: reminderEnabled ? "#639922" : "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", position: "relative" }}>
                <div style={{ position: "absolute", top: 3, left: reminderEnabled ? 20 : 3, width: 18, height: 18, borderRadius: "50%", background: reminderEnabled ? "white" : "var(--color-text-tertiary)", transition: "left 0.2s" }} />
              </div>
            </div>
            <label style={labelStyle}>Waktu Pengingat</label>
            <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} disabled={!reminderEnabled} style={{ ...inputStyle, marginBottom: "1rem", opacity: reminderEnabled ? 1 : 0.4 }} />
            <button onClick={scheduleReminder} disabled={!reminderEnabled} style={{ ...btnPrimary, padding: "9px 18px", fontSize: 14, width: "100%", opacity: reminderEnabled ? 1 : 0.4 }}>
              <i className="ti ti-bell" style={{ marginRight: 6 }} aria-hidden />Simpan Pengingat
            </button>
            {notifStatus && <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 10 }}>{notifStatus}</p>}
          </div>
        </div>
      )}

      {/* ADD/EDIT TASK MODAL */}
      <Modal show={showAdd} onClose={closeModal}>
        <h3 style={{ fontWeight: 500, fontSize: 16, margin: "0 0 4px" }}>{editingTask ? "Edit Tugas" : "Tambah Tugas Baru"}</h3>
        <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", margin: "0 0 14px" }}>
          Pemilik: <strong style={{ color: "var(--color-text-secondary)" }}>{editingTask ? editingTask.creator : currentUser}</strong>
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>Judul Tugas</label>
            <input value={newTask.title} onChange={e => setNewTask(v => ({ ...v, title: e.target.value }))} placeholder="contoh: Buat laporan bulanan" style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Dikerjakan oleh</label>
              <input value={newTask.assignee} onChange={e => setNewTask(v => ({ ...v, assignee: e.target.value }))} list="assignee-list" style={inputStyle} />
              <datalist id="assignee-list">{[...new Set([...MEMBERS, ...tasks.map(t => t.assignee), currentUser])].map(m => <option key={m} value={m} />)}</datalist>
            </div>
            <div>
              <label style={labelStyle}>Approver / Atasan</label>
              <input value={newTask.approver} onChange={e => setNewTask(v => ({ ...v, approver: e.target.value }))} list="approver-list" placeholder="(opsional)" style={inputStyle} />
              <datalist id="approver-list">{[...new Set([...MEMBERS, ...tasks.map(t => t.approver).filter(Boolean)])].map(m => <option key={m} value={m} />)}</datalist>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Prioritas</label>
              <select value={newTask.priority} onChange={e => setNewTask(v => ({ ...v, priority: e.target.value }))} style={inputStyle}>
                {["Tinggi", "Sedang", "Rendah"].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Reminder (hari sebelum)</label>
              <input type="number" min="0" max="30" value={newTask.reminderDays} onChange={e => setNewTask(v => ({ ...v, reminderDays: parseInt(e.target.value) || 0 }))} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Tanggal Mulai</label>
              <input type="date" value={newTask.startDate} onChange={e => setNewTask(v => ({ ...v, startDate: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Deadline</label>
              <input type="date" value={newTask.deadline} onChange={e => setNewTask(v => ({ ...v, deadline: e.target.value }))} style={inputStyle} />
            </div>
          </div>

          {/* Steps */}
          <div>
            <label style={labelStyle}>Langkah-langkah pengerjaan ({newTask.steps.length})</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <input value={newStep} onChange={e => setNewStep(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addStep())} placeholder="contoh: Riset data pasar" style={inputStyle} />
              <button onClick={addStep} style={{ ...btnSecondary, padding: "7px 12px" }}><i className="ti ti-plus" aria-hidden /></button>
            </div>
            {newTask.steps.length > 0 && (
              <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 10px" }}>
                {newTask.steps.map((s, i) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 13 }}>
                    <input type="checkbox" checked={s.done} onChange={() => toggleStepInForm(s.id)} style={{ cursor: "pointer" }} />
                    <span style={{ flex: 1, textDecoration: s.done ? "line-through" : "none", color: s.done ? "var(--color-text-tertiary)" : "var(--color-text-primary)" }}>{s.text}</span>
                    <button onClick={() => removeStepInForm(s.id)} style={{ background: "none", border: "none", color: "var(--color-text-tertiary)", cursor: "pointer", fontSize: 12 }} aria-label="Hapus langkah">
                      <i className="ti ti-x" />
                    </button>
                  </div>
                ))}
                <div style={{ marginTop: 6, fontSize: 11, color: "var(--color-text-secondary)" }}>
                  Progress: {calculateProgress(newTask)}% ({newTask.steps.filter(s => s.done).length}/{newTask.steps.length})
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={closeModal} style={btnSecondary}>Batal</button>
            <button onClick={saveTask} style={btnPrimary}>{editingTask ? "Update" : "Simpan"}</button>
          </div>
        </div>
      </Modal>

      {/* CONFIRM DELETE MODAL */}
      <Modal show={!!confirmDelete} onClose={() => setConfirmDelete(null)} width={340}>
        <h3 style={{ fontWeight: 500, fontSize: 16, margin: "0 0 8px" }}>
          <i className="ti ti-alert-triangle" style={{ marginRight: 6, color: "#A32D2D" }} aria-hidden />Hapus tugas?
        </h3>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 16px" }}>
          Tugas ini akan dihapus permanen dan tidak bisa dikembalikan.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => setConfirmDelete(null)} style={btnSecondary}>Batal</button>
          <button onClick={deleteTaskConfirmed} style={{ ...btnPrimary, background: "#A32D2D" }}>Ya, Hapus</button>
        </div>
      </Modal>
    </div>
  );
}
