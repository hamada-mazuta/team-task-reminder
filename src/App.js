import { useState, useEffect, useRef } from "react";
import { supabase, isAdminEmail } from "./supabaseClient";

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

const AVATAR_PALETTE = [
  { bg: "#EEEDFE", text: "#3C3489" }, { bg: "#E1F5EE", text: "#085041" },
  { bg: "#FBEAF0", text: "#72243E" }, { bg: "#FAEEDA", text: "#633806" },
  { bg: "#E6F1FB", text: "#0C447C" }, { bg: "#EAF3DE", text: "#3B6D11" },
];

function initials(name) {
  return (name || "?").split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();
}

function getAvatarColor(name, isAdmin) {
  if (isAdmin) return { bg: "#3C3489", text: "#fff" };
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (name || "").charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function Avatar({ name, size = 22, isAdmin = false }) {
  const c = getAvatarColor(name, isAdmin);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: c.bg, color: c.text, fontWeight: 500,
      fontSize: size * 0.42, display: "inline-flex",
      alignItems: "center", justifyContent: "center", flexShrink: 0
    }}>{initials(name)}</div>
  );
}

function Badge({ label, style }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: "2px 8px",
      borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 3, ...style
    }}>{label}</span>
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

function calculateProgress(steps) {
  if (!steps || steps.length === 0) return null;
  const done = steps.filter(s => s.done).length;
  return Math.round((done / steps.length) * 100);
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
  border: "none", borderRadius: 8, padding: "8px 16px",
  cursor: "pointer", fontSize: 13, fontWeight: 500
};
const btnSecondary = {
  background: "var(--color-background-secondary)",
  border: "0.5px solid var(--color-border-secondary)",
  borderRadius: 8, padding: "8px 16px", cursor: "pointer",
  fontSize: 13, color: "var(--color-text-primary)"
};

export default function App({ session }) {
  const user = session.user;
  const isAdmin = isAdminEmail(user.email);
  const userName = user.user_metadata?.full_name || user.email.split("@")[0];

  const [profiles, setProfiles] = useState([]);
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
    title: "", assignee_name: userName, approver_name: "", priority: "Sedang",
    start_date: "", deadline: "", reminder_days: 1, steps: []
  });
  const [newStep, setNewStep] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("");
  const reminderRef = useRef(null);

  useEffect(() => {
    ensureProfile();
    loadData();
    const channel = supabase.channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadTasks)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line
  }, []);

  async function ensureProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!data) {
      await supabase.from('profiles').insert({
        id: user.id, email: user.email, full_name: userName, is_admin: isAdmin
      });
    } else if (data.is_admin !== isAdmin) {
      await supabase.from('profiles').update({ is_admin: isAdmin }).eq('id', user.id);
    }
  }

  async function loadData() {
    setLoading(true);
    await Promise.all([loadProfiles(), loadTasks()]);
    setLoading(false);
  }

  async function loadProfiles() {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    if (data) setProfiles(data);
  }

  async function loadTasks() {
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (data) setTasks(data);
  }

  async function logout() { await supabase.auth.signOut(); }

  function findProfile(name) { return profiles.find(p => p.full_name === name); }
  function canEdit(task) { return isAdmin || task.creator_id === user.id || task.assignee_id === user.id; }
  function canDelete(task) { return isAdmin || task.creator_id === user.id; }

  const filtered = tasks.filter(t =>
    (filterStatus === "Semua" || t.status === filterStatus) &&
    (filterMember === "Semua" || t.assignee_name === filterMember)
  );

  const counts = {
    Belum: tasks.filter(t => t.status === "Belum").length,
    Dikerjakan: tasks.filter(t => t.status === "Dikerjakan").length,
    Selesai: tasks.filter(t => t.status === "Selesai").length,
  };

  async function saveTask() {
    if (!newTask.title.trim()) return;
    setSyncStatus("Menyimpan...");
    const assigneeProfile = findProfile(newTask.assignee_name);
    const approverProfile = newTask.approver_name ? findProfile(newTask.approver_name) : null;
    const taskData = {
      title: newTask.title,
      assignee_id: assigneeProfile?.id || null,
      assignee_name: newTask.assignee_name,
      approver_id: approverProfile?.id || null,
      approver_name: newTask.approver_name || null,
      priority: newTask.priority,
      start_date: newTask.start_date || null,
      deadline: newTask.deadline || null,
      reminder_days: newTask.reminder_days,
      steps: newTask.steps,
      updated_at: new Date().toISOString(),
    };
    if (editingTask) {
      const { error } = await supabase.from('tasks').update(taskData).eq('id', editingTask.id);
      if (error) { setSyncStatus("Gagal: " + error.message); return; }
    } else {
      const { error } = await supabase.from('tasks').insert({
        ...taskData, creator_id: user.id, creator_name: userName, status: "Belum",
      });
      if (error) { setSyncStatus("Gagal: " + error.message); return; }
    }
    setSyncStatus("Tersimpan");
    setTimeout(() => setSyncStatus(""), 1500);
    await loadTasks();
    closeModal();
  }

  function openEdit(task) {
    if (!canEdit(task)) return;
    setEditingTask(task);
    setNewTask({
      title: task.title,
      assignee_name: task.assignee_name || userName,
      approver_name: task.approver_name || "",
      priority: task.priority,
      start_date: task.start_date || "",
      deadline: task.deadline || "",
      reminder_days: task.reminder_days || 1,
      steps: task.steps || []
    });
    setShowAdd(true);
  }

  function closeModal() {
    setShowAdd(false);
    setEditingTask(null);
    setNewStep("");
    setNewTask({ title: "", assignee_name: userName, approver_name: "", priority: "Sedang", start_date: "", deadline: "", reminder_days: 1, steps: [] });
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

  async function toggleStepInTask(task, stepId) {
    if (!canEdit(task)) return;
    const steps = (task.steps || []).map(s => s.id === stepId ? { ...s, done: !s.done } : s);
    const allDone = steps.length > 0 && steps.every(s => s.done);
    const newStatus = allDone ? "Selesai" : (task.status === "Selesai" ? "Dikerjakan" : task.status);
    await supabase.from('tasks').update({ steps, status: newStatus, updated_at: new Date().toISOString() }).eq('id', task.id);
    await loadTasks();
  }

  async function updateStatus(task, status) {
    if (!canEdit(task)) return;
    await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', task.id);
    await loadTasks();
  }

  async function deleteTaskConfirmed() {
    if (!confirmDelete) return;
    await supabase.from('tasks').delete().eq('id', confirmDelete);
    setConfirmDelete(null);
    await loadTasks();
  }

  async function generateSummary() {
    setLoadingSummary(true); setShowSummary(true); setSummary("");
    setTimeout(() => {
      setSummary(`Halo ${userName}!\n\nFitur AI rangkuman akan diaktifkan di Tahap 3 (bersama notifikasi email). Saat ini kamu bisa lihat statistik tim di tab Statistik untuk overview tugas yang ada.`);
      setLoadingSummary(false);
    }, 800);
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
        const myPending = tasks.filter(t => t.assignee_id === user.id && t.status !== "Selesai").length;
        new Notification("Pengingat Tugas Tim", { body: `Halo ${userName}! Ada ${myPending} tugasmu yang belum selesai.` });
      }, ms);
      const mins = Math.round(ms / 60000);
      setNotifStatus(`Aktif — muncul dalam ${mins > 60 ? Math.round(mins / 60) + " jam" : mins + " menit"}.`);
    });
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const stats = {
    total: tasks.length, selesai: counts.Selesai,
    completionRate: tasks.length > 0 ? Math.round((counts.Selesai / tasks.length) * 100) : 0,
    perMember: {}, overdue: 0, today: 0,
  };
  tasks.forEach(t => {
    const k = t.assignee_name || "Belum di-assign";
    if (!stats.perMember[k]) stats.perMember[k] = { total: 0, done: 0 };
    stats.perMember[k].total++;
    if (t.status === "Selesai") stats.perMember[k].done++;
    if (t.deadline && t.deadline < todayStr && t.status !== "Selesai") stats.overdue++;
    if (t.deadline === todayStr && t.status !== "Selesai") stats.today++;
  });

  if (loading) return <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-text-secondary)" }}>Memuat data...</div>;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem 1rem", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>
          ✅ Team Task Reminder
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {syncStatus && <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{syncStatus}</span>}
          <button onClick={logout} style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "var(--color-background-secondary)",
            color: "var(--color-text-secondary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: 999, padding: "4px 10px 4px 4px",
            cursor: "pointer", fontSize: 12
          }}>
            <Avatar name={userName} size={22} isAdmin={isAdmin} />
            {userName}
            {isAdmin && <span style={{ fontSize: 11, marginLeft: 2 }}>🛡️</span>}
            <span style={{ marginLeft: 4, fontSize: 11 }}>↗</span>
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: "1.25rem" }}>
        {[["Belum", "#FCEBEB", "#A32D2D"], ["Dikerjakan", "#FAEEDA", "#854F0B"], ["Selesai", "#EAF3DE", "#3B6D11"]].map(([s, bg, c]) => (
          <div key={s} onClick={() => setFilterStatus(filterStatus === s ? "Semua" : s)}
            style={{ background: bg, borderRadius: 10, padding: "10px 14px", cursor: "pointer", border: filterStatus === s ? `1.5px solid ${c}` : "1.5px solid transparent" }}>
            <div style={{ fontSize: 11, color: c, fontWeight: 500 }}>{s}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: c }}>{counts[s]}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: "1rem", overflowX: "auto" }}>
        {[["tasks", "Tugas"], ["stats", "Statistik"], ["summary", "AI"], ["settings", "Pengingat"]].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: "none", border: "none", padding: "8px 14px", cursor: "pointer", fontSize: 13,
            fontWeight: tab === t ? 500 : 400, whiteSpace: "nowrap",
            color: tab === t ? "var(--color-text-primary)" : "var(--color-text-secondary)",
            borderBottom: tab === t ? "2px solid var(--color-text-primary)" : "2px solid transparent",
          }}>{label}</button>
        ))}
      </div>

      {tab === "tasks" && (<>
        <div style={{ display: "flex", gap: 8, marginBottom: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <select value={filterMember} onChange={e => setFilterMember(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 10px" }}>
            <option>Semua</option>
            {profiles.map(p => <option key={p.id}>{p.full_name}</option>)}
          </select>
          <button onClick={loadTasks} style={{ ...btnSecondary, padding: "6px 10px" }}>↻</button>
          <div style={{ flex: 1 }} />
          <button onClick={() => { setNewTask(v => ({ ...v, assignee_name: userName })); setShowAdd(true); }} style={{ ...btnPrimary, padding: "7px 14px" }}>+ Tambah Tugas</button>
        </div>

        {filtered.length === 0 && <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-secondary)", fontSize: 14 }}>Tidak ada tugas.</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(t => {
            const progress = calculateProgress(t.steps);
            const editable = canEdit(t);
            const deletable = canDelete(t);
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
                    <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 8, color: "var(--color-text-primary)", textDecoration: t.status === "Selesai" ? "line-through" : "none" }}>
                      {t.title}
                      {isOverdue && <Badge label="Terlambat" style={{ background: "#FCEBEB", color: "#A32D2D", marginLeft: 8 }} />}
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
                      <Badge label={t.priority} style={{ background: PRIORITY_COLOR[t.priority].bg, color: PRIORITY_COLOR[t.priority].text }} />
                      {[["pemilik", t.creator_name], ["kerjakan", t.assignee_name], ...(t.approver_name ? [["approver", t.approver_name]] : [])].map(([role, name]) => {
                        const profileMatch = profiles.find(p => p.full_name === name);
                        return (
                          <span key={role} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--color-background-secondary)", borderRadius: 999, padding: "2px 8px 2px 3px", fontSize: 11, color: "var(--color-text-secondary)" }}>
                            <Avatar name={name} size={16} isAdmin={profileMatch?.is_admin} />
                            <span style={{ fontWeight: 500 }}>{name}</span>
                            <span style={{ color: "var(--color-text-tertiary)", fontSize: 10 }}>{role}</span>
                          </span>
                        );
                      })}
                      {t.start_date && <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>▶ {t.start_date}</span>}
                      {t.deadline && <span style={{ fontSize: 11, color: isOverdue ? "#A32D2D" : "var(--color-text-tertiary)" }}>📅 {t.deadline}</span>}
                    </div>

                    {t.steps && t.steps.length > 0 && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                        {t.steps.map(s => (
                          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 13 }}>
                            <input type="checkbox" checked={s.done} onChange={() => toggleStepInTask(t, s.id)} disabled={!editable}
                              style={{ width: 14, height: 14, cursor: editable ? "pointer" : "not-allowed" }} />
                            <span style={{ textDecoration: s.done ? "line-through" : "none", color: s.done ? "var(--color-text-tertiary)" : "var(--color-text-primary)" }}>{s.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                    <select value={t.status} onChange={e => updateStatus(t, e.target.value)} disabled={!editable}
                      style={{ fontSize: 11, padding: "3px 7px", borderRadius: 6, border: `0.5px solid ${STATUS_COLOR[t.status].border}`, background: STATUS_COLOR[t.status].bg, color: STATUS_COLOR[t.status].text, cursor: editable ? "pointer" : "not-allowed" }}>
                      {STATUS_LIST.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <div style={{ display: "flex", gap: 4 }}>
                      {editable && <button onClick={() => openEdit(t)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", padding: 2, fontSize: 14 }}>✏️</button>}
                      {deletable && <button onClick={() => setConfirmDelete(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", padding: 2, fontSize: 14 }}>🗑️</button>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>)}

      {tab === "stats" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Total Tugas</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: "var(--color-text-primary)" }}>{stats.total}</div>
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
            <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 12px", color: "var(--color-text-primary)" }}>Performa per Anggota</h3>
            {Object.entries(stats.perMember).sort((a, b) => b[1].total - a[1].total).map(([name, d]) => {
              const pct = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
              return (
                <div key={name} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--color-text-primary)" }}>
                      <Avatar name={name} size={20} />{name}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{d.done}/{d.total} • {pct}%</span>
                  </div>
                  <ProgressBar percent={pct} height={6} />
                </div>
              );
            })}
            {Object.keys(stats.perMember).length === 0 && <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", margin: 0 }}>Belum ada data.</p>}
          </div>
        </div>
      )}

      {tab === "summary" && (
        <div>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: "1rem" }}>AI akan merangkum tugas untuk {userName}.</p>
          <button onClick={generateSummary} disabled={loadingSummary} style={{ ...btnPrimary, padding: "9px 18px", fontSize: 14, marginBottom: "1.25rem" }}>
            ✨ {loadingSummary ? "Sedang merangkum..." : "Rangkum Sekarang"}
          </button>
          {showSummary && (
            <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1rem 1.25rem" }}>
              {loadingSummary ? <span style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>Menghubungi AI...</span>
                : <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "var(--color-text-primary)" }}>{summary}</div>}
            </div>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div style={{ maxWidth: 360 }}>
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <span style={{ fontWeight: 500, fontSize: 14, color: "var(--color-text-primary)" }}>Aktifkan Pengingat</span>
              <div onClick={() => setReminderEnabled(v => !v)} style={{ width: 42, height: 24, borderRadius: 999, cursor: "pointer", background: reminderEnabled ? "#639922" : "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", position: "relative" }}>
                <div style={{ position: "absolute", top: 3, left: reminderEnabled ? 20 : 3, width: 18, height: 18, borderRadius: "50%", background: reminderEnabled ? "white" : "var(--color-text-tertiary)", transition: "left 0.2s" }} />
              </div>
            </div>
            <label style={labelStyle}>Waktu Pengingat</label>
            <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} disabled={!reminderEnabled} style={{ ...inputStyle, marginBottom: "1rem", opacity: reminderEnabled ? 1 : 0.4 }} />
            <button onClick={scheduleReminder} disabled={!reminderEnabled} style={{ ...btnPrimary, padding: "9px 18px", fontSize: 14, width: "100%", opacity: reminderEnabled ? 1 : 0.4 }}>🔔 Simpan Pengingat</button>
            {notifStatus && <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 10 }}>{notifStatus}</p>}
          </div>

          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem", marginTop: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 12px", color: "var(--color-text-primary)" }}>Akun</h3>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 4px" }}>Email: <strong>{user.email}</strong></p>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>Status: <strong>{isAdmin ? "Admin 🛡️" : "Anggota Tim"}</strong></p>
            <button onClick={logout} style={{ ...btnSecondary, width: "100%" }}>Keluar</button>
          </div>
        </div>
      )}

      <Modal show={showAdd} onClose={closeModal}>
        <h3 style={{ fontWeight: 500, fontSize: 16, margin: "0 0 4px", color: "var(--color-text-primary)" }}>{editingTask ? "Edit Tugas" : "Tambah Tugas Baru"}</h3>
        <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", margin: "0 0 14px" }}>
          Pemilik: <strong style={{ color: "var(--color-text-secondary)" }}>{editingTask ? editingTask.creator_name : userName}</strong>
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>Judul Tugas</label>
            <input value={newTask.title} onChange={e => setNewTask(v => ({ ...v, title: e.target.value }))} placeholder="contoh: Buat laporan bulanan" style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Dikerjakan oleh</label>
              <select value={newTask.assignee_name} onChange={e => setNewTask(v => ({ ...v, assignee_name: e.target.value }))} style={inputStyle}>
                {profiles.map(p => <option key={p.id} value={p.full_name}>{p.full_name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Approver / Atasan</label>
              <select value={newTask.approver_name} onChange={e => setNewTask(v => ({ ...v, approver_name: e.target.value }))} style={inputStyle}>
                <option value="">(tidak ada)</option>
                {profiles.map(p => <option key={p.id} value={p.full_name}>{p.full_name}</option>)}
              </select>
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
              <input type="number" min="0" max="30" value={newTask.reminder_days} onChange={e => setNewTask(v => ({ ...v, reminder_days: parseInt(e.target.value) || 0 }))} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Tanggal Mulai</label>
              <input type="date" value={newTask.start_date} onChange={e => setNewTask(v => ({ ...v, start_date: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Deadline</label>
              <input type="date" value={newTask.deadline} onChange={e => setNewTask(v => ({ ...v, deadline: e.target.value }))} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Langkah-langkah pengerjaan ({newTask.steps.length})</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <input value={newStep} onChange={e => setNewStep(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addStep())} placeholder="contoh: Riset data pasar" style={inputStyle} />
              <button onClick={addStep} style={{ ...btnSecondary, padding: "7px 12px" }}>+</button>
            </div>
            {newTask.steps.length > 0 && (
              <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 10px" }}>
                {newTask.steps.map(s => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 13 }}>
                    <input type="checkbox" checked={s.done} onChange={() => toggleStepInForm(s.id)} style={{ cursor: "pointer" }} />
                    <span style={{ flex: 1, textDecoration: s.done ? "line-through" : "none", color: s.done ? "var(--color-text-tertiary)" : "var(--color-text-primary)" }}>{s.text}</span>
                    <button onClick={() => removeStepInForm(s.id)} style={{ background: "none", border: "none", color: "var(--color-text-tertiary)", cursor: "pointer", fontSize: 12 }}>✕</button>
                  </div>
                ))}
                <div style={{ marginTop: 6, fontSize: 11, color: "var(--color-text-secondary)" }}>
                  Progress: {calculateProgress(newTask.steps)}% ({newTask.steps.filter(s => s.done).length}/{newTask.steps.length})
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

      <Modal show={!!confirmDelete} onClose={() => setConfirmDelete(null)} width={340}>
        <h3 style={{ fontWeight: 500, fontSize: 16, margin: "0 0 8px", color: "var(--color-text-primary)" }}>⚠️ Hapus tugas?</h3>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 16px" }}>Tugas ini akan dihapus permanen dan tidak bisa dikembalikan.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => setConfirmDelete(null)} style={btnSecondary}>Batal</button>
          <button onClick={deleteTaskConfirmed} style={{ ...btnPrimary, background: "#A32D2D", color: "#fff" }}>Ya, Hapus</button>
        </div>
      </Modal>
    </div>
  );
}
