import { useState, useEffect, useRef } from "react";

const MEMBERS = ["Aku", "Budi", "Sari", "Dani", "Rizky"];
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

const STORAGE_KEY = "team_tasks_v1";
const SETTINGS_KEY = "task_settings_v1";

// ── Simple shared storage via a free JSONBin (replace BIN_ID + API_KEY) ──
// OR use localStorage as fallback for single-user mode
const useLocalStorage = true; // set false kalau pakai JSONBin

async function sharedGet() {
  if (useLocalStorage) {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? JSON.parse(v) : null;
  }
}

async function sharedSet(data) {
  if (useLocalStorage) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

function initials(name) {
  return name.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = {
  "Aku": { bg: "#EEEDFE", text: "#3C3489" },
  "Budi": { bg: "#E1F5EE", text: "#085041" },
  "Sari": { bg: "#FBEAF0", text: "#72243E" },
  "Dani": { bg: "#FAEEDA", text: "#633806" },
  "Rizky": { bg: "#E6F1FB", text: "#0C447C" },
};

function getAvatarColor(name) {
  if (AVATAR_COLORS[name]) return AVATAR_COLORS[name];
  const colors = Object.values(AVATAR_COLORS);
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function Avatar({ name, size = 22 }) {
  const c = getAvatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: c.bg, color: c.text, fontWeight: 500,
      fontSize: size * 0.42, display: "inline-flex",
      alignItems: "center", justifyContent: "center", flexShrink: 0
    }}>{initials(name)}</div>
  );
}

function Badge({ label, style, icon }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: "2px 8px",
      borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 3, ...style
    }}>
      {icon && <i className={`ti ${icon}`} style={{ fontSize: 11 }} aria-hidden="true" />}
      {label}
    </span>
  );
}

function Modal({ show, onClose, children }) {
  if (!show) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem"
    }} onClick={onClose}>
      <div style={{
        background: "var(--color-background-primary)",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: 16, padding: "1.5rem", width: 380, maxWidth: "100%"
      }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
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

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem("current_user") || null);
  const [userInput, setUserInput] = useState("Aku");
  const [tasks, setTasks] = useState([]);
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [filterMember, setFilterMember] = useState("Semua");
  const [tab, setTab] = useState("tasks");
  const [showAdd, setShowAdd] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [reminderTime, setReminderTime] = useState("08:00");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [notifStatus, setNotifStatus] = useState("");
  const [newTask, setNewTask] = useState({ title: "", assignee: "Aku", priority: "Sedang", deadline: "" });
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("");
  const reminderRef = useRef(null);

  useEffect(() => {
    loadTasks();
    const s = localStorage.getItem(SETTINGS_KEY);
    if (s) {
      const p = JSON.parse(s);
      if (p.reminderTime) setReminderTime(p.reminderTime);
      if (typeof p.reminderEnabled === "boolean") setReminderEnabled(p.reminderEnabled);
    }
    const interval = setInterval(loadTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadTasks() {
    try {
      const data = await sharedGet();
      if (data) {
        setTasks(data);
      } else {
        const seed = [
          { id: 1, title: "Review dokumen proposal Q2", assignee: "Budi", creator: "Sari", priority: "Tinggi", status: "Belum", deadline: "", createdAt: Date.now() },
          { id: 2, title: "Update laporan mingguan", assignee: "Sari", creator: "Aku", priority: "Sedang", status: "Dikerjakan", deadline: "", createdAt: Date.now() },
        ];
        setTasks(seed);
        await sharedSet(seed);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function saveTasks(updated) {
    setSyncStatus("Menyimpan...");
    setTasks(updated);
    try {
      await sharedSet(updated);
      setSyncStatus("Tersimpan");
      setTimeout(() => setSyncStatus(""), 1500);
    } catch {
      setSyncStatus("Gagal simpan");
      setTimeout(() => setSyncStatus(""), 2000);
    }
  }

  function handleSetUser() {
    const name = userInput.trim();
    if (!name) return;
    setCurrentUser(name);
    localStorage.setItem("current_user", name);
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

  async function addTask() {
    if (!newTask.title.trim() || !currentUser) return;
    const updated = [...tasks, { ...newTask, id: Date.now(), status: "Belum", creator: currentUser, createdAt: Date.now() }];
    await saveTasks(updated);
    setNewTask({ title: "", assignee: currentUser, priority: "Sedang", deadline: "" });
    setShowAdd(false);
  }

  async function updateStatus(id, status) {
    await saveTasks(tasks.map(t => t.id === id ? { ...t, status } : t));
  }

  async function deleteTask(id) {
    await saveTasks(tasks.filter(t => t.id !== id));
  }

  async function generateSummary() {
    setLoadingSummary(true);
    setShowSummary(true);
    setSummary("");
    const today = new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const pending = tasks.filter(t => t.status !== "Selesai");
    const myTasks = pending.filter(t => t.assignee === currentUser);
    const prompt = `Kamu adalah asisten tim produktivitas. Hari ini ${today}. Kamu sedang berbicara dengan ${currentUser}.

Daftar semua tugas tim yang belum selesai:
${pending.map(t => `- [${t.priority}] ${t.title} (Pemilik: ${t.creator}, Assignee: ${t.assignee}, Deadline: ${t.deadline || "-"}, Status: ${t.status})`).join("\n")}

Tugas milik ${currentUser}:
${myTasks.length > 0 ? myTasks.map(t => `- ${t.title}`).join("\n") : "(tidak ada)"}

Buat rangkuman singkat dalam Bahasa Indonesia: sapa ${currentUser} secara personal, highlight prioritas tinggi & deadline dekat, beri rekomendasi fokus hari ini, singgung kondisi tim. Format poin-poin pendek, maks 200 kata.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      setSummary(data.content?.find(b => b.type === "text")?.text || "Gagal mengambil rangkuman.");
    } catch {
      setSummary("Gagal menghubungi AI. Coba lagi.");
    }
    setLoadingSummary(false);
  }

  function scheduleReminder() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ reminderTime, reminderEnabled }));
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
        new Notification("Pengingat Tugas Tim", { body: `Halo ${currentUser}! Ada ${myPending} tugasmu yang belum selesai. Yuk semangat!` });
      }, ms);
      const mins = Math.round(ms / 60000);
      setNotifStatus(`Pengingat aktif — muncul dalam ${mins > 60 ? Math.round(mins / 60) + " jam" : mins + " menit"}.`);
    });
  }

  if (!currentUser) {
    return (
      <div style={{ maxWidth: 400, margin: "4rem auto", padding: "0 1rem" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 6 }}>
          <i className="ti ti-checklist" style={{ marginRight: 8 }} aria-hidden="true" />Team Task Reminder
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>Masukkan namamu agar tim tahu siapa yang membuat & mengerjakan tugas.</p>
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
          <label style={labelStyle}>Nama kamu</label>
          <input value={userInput} onChange={e => setUserInput(e.target.value)} list="member-list"
            onKeyDown={e => e.key === "Enter" && handleSetUser()}
            placeholder="Contoh: Budi" style={{ ...inputStyle, marginBottom: 12 }} />
          <datalist id="member-list">{MEMBERS.map(m => <option key={m} value={m} />)}</datalist>
          <button onClick={handleSetUser} style={{
            background: "var(--color-text-primary)", color: "var(--color-background-primary)",
            border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 14, fontWeight: 500, width: "100%"
          }}>Masuk</button>
        </div>
      </div>
    );
  }

  if (loading) return <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-text-secondary)" }}>Memuat data tim...</div>;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "1.5rem 1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>
          <i className="ti ti-checklist" style={{ marginRight: 8 }} aria-hidden="true" />Team Task Reminder
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {syncStatus && <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{syncStatus}</span>}
          <button onClick={() => { setCurrentUser(null); localStorage.removeItem("current_user"); }} style={{
            display: "flex", alignItems: "center", gap: 6, background: "var(--color-background-secondary)",
            border: "0.5px solid var(--color-border-tertiary)", borderRadius: 999, padding: "4px 10px 4px 4px",
            cursor: "pointer", fontSize: 12, color: "var(--color-text-secondary)"
          }}>
            <Avatar name={currentUser} size={22} />{currentUser}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: "1.25rem" }}>
        {[["Belum","#FCEBEB","#A32D2D"],["Dikerjakan","#FAEEDA","#854F0B"],["Selesai","#EAF3DE","#3B6D11"]].map(([s,bg,c]) => (
          <div key={s} onClick={() => setFilterStatus(filterStatus === s ? "Semua" : s)}
            style={{ background: bg, borderRadius: 10, padding: "10px 14px", cursor: "pointer", border: filterStatus === s ? `1.5px solid ${c}` : "1.5px solid transparent" }}>
            <div style={{ fontSize: 11, color: c, fontWeight: 500 }}>{s}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: c }}>{counts[s]}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: "1rem" }}>
        {[["tasks","ti-layout-list","Tugas"],["summary","ti-sparkles","Rangkuman AI"],["settings","ti-settings","Pengingat"]].map(([t,icon,label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: "none", border: "none", padding: "8px 14px", cursor: "pointer", fontSize: 13,
            fontWeight: tab === t ? 500 : 400,
            color: tab === t ? "var(--color-text-primary)" : "var(--color-text-secondary)",
            borderBottom: tab === t ? "2px solid var(--color-text-primary)" : "2px solid transparent",
          }}>
            <i className={`ti ${icon}`} style={{ marginRight: 5, fontSize: 14 }} aria-hidden="true" />{label}
          </button>
        ))}
      </div>

      {tab === "tasks" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <select value={filterMember} onChange={e => setFilterMember(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 10px" }}>
              <option>Semua</option>
              {[...new Set([...MEMBERS, ...tasks.map(t => t.assignee)])].map(m => <option key={m}>{m}</option>)}
            </select>
            <button onClick={loadTasks} style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary)" }}>
              <i className="ti ti-refresh" style={{ fontSize: 14 }} aria-hidden="true" />
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={() => { setNewTask(v => ({ ...v, assignee: currentUser })); setShowAdd(true); }} style={{
              background: "var(--color-text-primary)", color: "var(--color-background-primary)",
              border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 500
            }}>
              <i className="ti ti-plus" style={{ marginRight: 5, fontSize: 14 }} aria-hidden="true" />Tambah Tugas
            </button>
          </div>

          {filtered.length === 0 && <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-secondary)", fontSize: 14 }}>Tidak ada tugas.</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(t => (
              <div key={t.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "12px 14px", opacity: t.status === "Selesai" ? 0.65 : 1 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 8, textDecoration: t.status === "Selesai" ? "line-through" : "none" }}>{t.title}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <Badge label={t.priority} icon="ti-flag" style={{ background: PRIORITY_COLOR[t.priority].bg, color: PRIORITY_COLOR[t.priority].text }} />
                      {[["pemilik", t.creator], ["kerjakan", t.assignee]].map(([role, name]) => (
                        <span key={role} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--color-background-secondary)", borderRadius: 999, padding: "2px 8px 2px 3px", fontSize: 11, color: "var(--color-text-secondary)" }}>
                          <Avatar name={name || "?"} size={16} />
                          <span style={{ fontWeight: 500 }}>{name}</span>
                          <span style={{ color: "var(--color-text-tertiary)", fontSize: 10 }}>{role}</span>
                        </span>
                      ))}
                      {t.deadline && <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <i className="ti ti-calendar" style={{ fontSize: 11 }} aria-hidden="true" />{t.deadline}
                      </span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                    <select value={t.status} onChange={e => updateStatus(t.id, e.target.value)} style={{ fontSize: 11, padding: "3px 7px", borderRadius: 6, border: `0.5px solid ${STATUS_COLOR[t.status].border}`, background: STATUS_COLOR[t.status].bg, color: STATUS_COLOR[t.status].text, cursor: "pointer" }}>
                      {STATUS_LIST.map(s => <option key={s}>{s}</option>)}
                    </select>
                    {t.creator === currentUser && (
                      <button onClick={() => deleteTask(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", padding: 2, fontSize: 13 }} aria-label="Hapus tugas">
                        <i className="ti ti-trash" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "summary" && (
        <div>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: "1rem" }}>AI akan merangkum tugas dan memberi rekomendasi fokus hari ini untuk {currentUser}.</p>
          <button onClick={generateSummary} disabled={loadingSummary} style={{ background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 14, fontWeight: 500, marginBottom: "1.25rem" }}>
            <i className="ti ti-sparkles" style={{ marginRight: 6 }} aria-hidden="true" />{loadingSummary ? "Sedang merangkum..." : "Rangkum Sekarang"}
          </button>
          {showSummary && (
            <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1rem 1.25rem" }}>
              {loadingSummary ? <span style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>Menghubungi AI...</span>
                : <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{summary}</div>}
            </div>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div style={{ maxWidth: 360 }}>
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>Aktifkan Pengingat</span>
              <div onClick={() => setReminderEnabled(v => !v)} style={{ width: 42, height: 24, borderRadius: 999, cursor: "pointer", background: reminderEnabled ? "#639922" : "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", position: "relative", transition: "background 0.2s" }}>
                <div style={{ position: "absolute", top: 3, left: reminderEnabled ? 20 : 3, width: 18, height: 18, borderRadius: "50%", background: reminderEnabled ? "white" : "var(--color-text-tertiary)", transition: "left 0.2s" }} />
              </div>
            </div>
            <label style={labelStyle}>Waktu Pengingat</label>
            <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} disabled={!reminderEnabled} style={{ ...inputStyle, marginBottom: "1rem", opacity: reminderEnabled ? 1 : 0.4 }} />
            <button onClick={scheduleReminder} disabled={!reminderEnabled} style={{ background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 14, fontWeight: 500, width: "100%", opacity: reminderEnabled ? 1 : 0.4 }}>
              <i className="ti ti-bell" style={{ marginRight: 6 }} aria-hidden="true" />Simpan Pengingat
            </button>
            {notifStatus && <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 10, marginBottom: 0 }}>{notifStatus}</p>}
          </div>
        </div>
      )}

      <Modal show={showAdd} onClose={() => setShowAdd(false)}>
        <h3 style={{ fontWeight: 500, fontSize: 16, margin: "0 0 4px" }}>Tambah Tugas Baru</h3>
        <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", margin: "0 0 14px" }}>Pemilik: <strong style={{ color: "var(--color-text-secondary)" }}>{currentUser}</strong></p>
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
              <label style={labelStyle}>Prioritas</label>
              <select value={newTask.priority} onChange={e => setNewTask(v => ({ ...v, priority: e.target.value }))} style={inputStyle}>
                {["Tinggi","Sedang","Rendah"].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Deadline</label>
            <input type="date" value={newTask.deadline} onChange={e => setNewTask(v => ({ ...v, deadline: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={() => setShowAdd(false)} style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>Batal</button>
            <button onClick={addTask} style={{ background: "var(--color-text-primary)", color: "var(--color-background-primary)", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Simpan</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
