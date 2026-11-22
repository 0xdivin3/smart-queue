"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import Shell from "@/components/Shell";
import { Bell, CheckCheck, Clock, Megaphone, Plus, Ticket, Users, X } from "lucide-react";

export default function Student() {
  const profile = useProfile("student");
  const [services, setServices] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const [s, t, n] = await Promise.all([
      supabase.rpc("service_overview"),
      supabase.rpc("my_queue"),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(8),
    ]);
    setServices(s.data ?? []);
    setTickets(t.data ?? []);
    setNotes(n.data ?? []);
  }, []);

  useEffect(() => {
    if (!profile) return;
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, [profile, load]);

  async function join(id: string) {
    setErr("");
    const { error } = await supabase.rpc("join_queue", { p_service_id: id });
    if (error) setErr(error.message);
    load();
  }
  async function cancel(id: string) {
    setErr("");
    const { error } = await supabase.rpc("cancel_ticket", { p_id: id });
    if (error) setErr(error.message);
    load();
  }
  async function markRead() {
    await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
    load();
  }

  if (!profile) return <p className="wrap">Loading...</p>;

  return (
    <Shell profile={profile}>
      {err && <p className="err">{err}</p>}
      <h2><Ticket size={20} className="ico" />My tickets today</h2>
      {tickets.length === 0 && <p className="muted">No tickets yet. Pick a service below to join a queue.</p>}
      {tickets.map((t) => (
        <div className="card" key={t.id}>
          <div className="row">
            <div>
              <div className="ticket">{t.ticket_number}</div>
              <div>{t.service_name} - {t.office_name}</div>
            </div>
            <span className={"badge " + t.status}>{t.status.replace("_", " ")}</span>
          </div>
          {t.status === "waiting" && (
            <p><Clock size={16} className="ico" />Position <b>{t.pos}</b> in line - about <b>{t.wait_min}</b> min wait</p>
          )}
          {t.status === "called" && <p><Megaphone size={16} className="ico" /><b>Your number has been called. Please go to {t.office_name} now.</b></p>}
          {t.status === "waiting" && <button className="alt" onClick={() => cancel(t.id)}><X size={16} /> Leave queue</button>}
        </div>
      ))}

      <h2><Users size={20} className="ico" />Join a queue</h2>
      <div className="grid">
        {services.map((s) => (
          <div className="card" key={s.service_id}>
            <b>{s.service_name}</b>
            <div className="muted">{s.office_name}</div>
            <p>{s.waiting} waiting - about {s.avg_service_minutes} min each</p>
            <button onClick={() => join(s.service_id)}><Plus size={16} /> Join queue</button>
          </div>
        ))}
      </div>

      <div className="row">
        <h2><Bell size={20} className="ico" />Notifications</h2>
        <button className="alt" onClick={markRead}><CheckCheck size={16} /> Mark all read</button>
      </div>
      {notes.length === 0 && <p className="muted">No notifications yet.</p>}
      {notes.map((n) => (
        <div className="card" key={n.id} style={{ opacity: n.is_read ? 0.6 : 1 }}>
          <Bell size={14} className="ico" />{n.message}
          <div className="muted">{new Date(n.created_at).toLocaleString()}</div>
        </div>
      ))}
    </Shell>
  );
}
