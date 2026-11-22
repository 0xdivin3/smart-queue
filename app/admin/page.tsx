"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import Shell from "@/components/Shell";
import { BarChart3, Building2, Plus, Save, UserPlus, Users } from "lucide-react";

function UserRow({ u, offices, onSave }: { u: any; offices: any[]; onSave: (id: string, role: string, office: string | null) => void }) {
  const [role, setRole] = useState(u.role);
  const [office, setOffice] = useState(u.office_id ?? "");
  return (
    <tr>
      <td>{u.full_name}<div className="muted">{u.email}</div></td>
      <td>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="student">student</option>
          <option value="staff">staff</option>
          <option value="admin">admin</option>
        </select>
      </td>
      <td>
        <select value={office} onChange={(e) => setOffice(e.target.value)} disabled={role !== "staff"}>
          <option value="">-</option>
          {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </td>
      <td><button onClick={() => onSave(u.id, role, role === "staff" ? office || null : null)}><Save size={16} /> Save</button></td>
    </tr>
  );
}

export default function Admin() {
  const profile = useProfile("admin");
  const [tab, setTab] = useState("stats");
  const [offices, setOffices] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [o, setO] = useState({ name: "", location: "" });
  const [s, setS] = useState({ office_id: "", name: "", prefix: "", avg_service_minutes: 10 });
  const [st, setSt] = useState({ full_name: "", email: "", password: "", office_id: "" });

  const load = useCallback(async () => {
    const [a, b, c, d] = await Promise.all([
      supabase.from("offices").select("*").order("name"),
      supabase.from("services").select("*").order("name"),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("daily_service_stats").select("*").order("queue_date", { ascending: false }).limit(60),
    ]);
    setOffices(a.data ?? []);
    setServices(b.data ?? []);
    setUsers(c.data ?? []);
    setStats(d.data ?? []);
  }, []);

  useEffect(() => { if (profile) load(); }, [profile, load]);

  async function run(p: any) {
    const { error } = await p;
    setMsg(error ? error.message : "Saved");
    load();
  }

  async function createStaff() {
    setMsg("");
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/create-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session?.access_token },
      body: JSON.stringify(st),
    });
    const out = await res.json();
    if (!res.ok) return setMsg(out.error ?? "Could not create staff account");
    setMsg("Saved");
    setSt({ full_name: "", email: "", password: "", office_id: "" });
    load();
  }

  if (!profile) return <p className="wrap">Loading...</p>;

  const officeName = (id: string) => offices.find((x) => x.id === id)?.name ?? "-";

  return (
    <Shell profile={profile}>
      <div className="tabs">
        {["stats", "offices", "users"].map((t) => (
          <button key={t} className={tab === t ? "" : "alt"} onClick={() => { setTab(t); setMsg(""); }}>
            {t === "stats" ? <BarChart3 size={16} /> : t === "offices" ? <Building2 size={16} /> : <Users size={16} />}{t === "stats" ? "Reports" : t === "offices" ? "Offices & services" : "Users"}
          </button>
        ))}
      </div>
      {msg && <p className={msg === "Saved" ? "ok" : "err"}>{msg}</p>}

      {tab === "stats" && (
        <div className="card scroll">
          <h3>Daily service statistics</h3>
          <table>
            <thead>
              <tr><th>Date</th><th>Office</th><th>Service</th><th>Total</th><th>Done</th><th>Skipped</th><th>Cancelled</th><th>Avg wait (min)</th><th>Avg service (min)</th></tr>
            </thead>
            <tbody>
              {stats.map((r, i) => (
                <tr key={i}>
                  <td>{r.queue_date}</td><td>{r.office_name}</td><td>{r.service_name}</td>
                  <td>{r.total_requests}</td><td>{r.completed}</td><td>{r.skipped}</td><td>{r.cancelled}</td>
                  <td>{r.avg_wait_minutes ?? "-"}</td><td>{r.avg_service_minutes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {stats.length === 0 && <p className="muted">No queue activity yet.</p>}
        </div>
      )}

      {tab === "offices" && (
        <>
          <div className="card">
            <h3>Add office</h3>
            <input placeholder="Office name" value={o.name} onChange={(e) => setO({ ...o, name: e.target.value })} />
            <input placeholder="Location (optional)" value={o.location} onChange={(e) => setO({ ...o, location: e.target.value })} />
            <button onClick={() => { run(supabase.from("offices").insert(o)); setO({ name: "", location: "" }); }} disabled={!o.name}><Plus size={16} /> Add office</button>
          </div>
          <div className="card">
            <h3>Add service</h3>
            <select value={s.office_id} onChange={(e) => setS({ ...s, office_id: e.target.value })}>
              <option value="">Select office</option>
              {offices.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <input placeholder="Service name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
            <input placeholder="Ticket prefix, 2-4 capital letters (e.g. BUR)" value={s.prefix} onChange={(e) => setS({ ...s, prefix: e.target.value.toUpperCase() })} />
            <input type="number" min={1} placeholder="Average minutes per student" value={s.avg_service_minutes} onChange={(e) => setS({ ...s, avg_service_minutes: Number(e.target.value) })} />
            <button
              disabled={!s.office_id || !s.name || !s.prefix}
              onClick={() => { run(supabase.from("services").insert(s)); setS({ office_id: "", name: "", prefix: "", avg_service_minutes: 10 }); }}
            >
              <Plus size={16} /> Add service
            </button>
          </div>
          <div className="card scroll">
            <h3>Services</h3>
            <table>
              <thead><tr><th>Office</th><th>Service</th><th>Prefix</th><th>Avg min</th><th>Active</th></tr></thead>
              <tbody>
                {services.map((x) => (
                  <tr key={x.id}>
                    <td>{officeName(x.office_id)}</td><td>{x.name}</td><td>{x.prefix}</td><td>{x.avg_service_minutes}</td>
                    <td><button className="alt" onClick={() => run(supabase.from("services").update({ is_active: !x.is_active }).eq("id", x.id))}>{x.is_active ? "Yes" : "No"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "users" && (
        <>
        <div className="card">
          <h3>Create staff account</h3>
          <input placeholder="Full name" value={st.full_name} onChange={(e) => setSt({ ...st, full_name: e.target.value })} />
          <input type="email" placeholder="Email" value={st.email} onChange={(e) => setSt({ ...st, email: e.target.value })} />
          <input type="text" placeholder="Temporary password (min 6 characters)" value={st.password} onChange={(e) => setSt({ ...st, password: e.target.value })} />
          <select value={st.office_id} onChange={(e) => setSt({ ...st, office_id: e.target.value })}>
            <option value="">Select office</option>
            {offices.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <button onClick={createStaff} disabled={!st.full_name || !st.email || !st.office_id || st.password.length < 6}>
            <UserPlus size={16} /> Create staff account
          </button>
          <p className="muted">Staff then log in at /staff/login with this email and password.</p>
        </div>
        <div className="card scroll">
          <h3>All users</h3>
          <p className="muted">You can also change any user's role or office here.</p>
          <table>
            <thead><tr><th>User</th><th>Role</th><th>Office (staff)</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <UserRow
                  key={u.id + u.role + u.office_id}
                  u={u}
                  offices={offices}
                  onSave={(id, role, office) => run(supabase.from("profiles").update({ role, office_id: office }).eq("id", id))}
                />
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </Shell>
  );
}
