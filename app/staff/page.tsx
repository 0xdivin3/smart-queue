"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import Shell from "@/components/Shell";
import { CheckCircle2, Megaphone, Play, SkipForward, Users, X } from "lucide-react";

export default function Staff() {
  const profile = useProfile("staff");
  const [services, setServices] = useState<any[]>([]);
  const [sid, setSid] = useState("");
  const [board, setBoard] = useState<any[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!profile?.office_id) return;
    supabase
      .from("services")
      .select("*")
      .eq("office_id", profile.office_id)
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        setServices(data ?? []);
        if (data?.length) setSid(data[0].id);
      });
  }, [profile]);

  const load = useCallback(async () => {
    if (!sid) return;
    const { data, error } = await supabase.rpc("staff_board", { p_service_id: sid });
    if (error) setErr(error.message);
    else setBoard(data ?? []);
  }, [sid]);

  useEffect(() => {
    load();
    const i = setInterval(load, 4000);
    return () => clearInterval(i);
  }, [load]);

  async function callNext() {
    setErr("");
    const { error } = await supabase.rpc("call_next", { p_service_id: sid });
    if (error) setErr(error.message);
    load();
  }
  async function setStatus(id: string, status: string) {
    setErr("");
    const { error } = await supabase.rpc("set_ticket_status", { p_id: id, p_status: status });
    if (error) setErr(error.message);
    load();
  }

  if (!profile) return <p className="wrap">Loading...</p>;

  const active = board.filter((b) => b.status !== "waiting");
  const waiting = board.filter((b) => b.status === "waiting");

  return (
    <Shell profile={profile}>
      <div className="row">
        <h2><Users size={20} className="ico" />Service counter</h2>
        <select style={{ maxWidth: 280 }} value={sid} onChange={(e) => setSid(e.target.value)}>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {err && <p className="err">{err}</p>}

      <div className="card row">
        <div><b>{waiting.length}</b> waiting</div>
        <button onClick={callNext} disabled={waiting.length === 0}><Megaphone size={16} /> Call next student</button>
      </div>

      <h3>Now serving</h3>
      {active.length === 0 && <p className="muted">Nobody is being served.</p>}
      {active.map((b) => (
        <div className="card row" key={b.id}>
          <div>
            <span className="ticket">{b.ticket_number}</span>
            <div>{b.student_name} {b.matric_no ? `(${b.matric_no})` : ""}</div>
          </div>
          <span className={"badge " + b.status}>{b.status.replace("_", " ")}</span>
          <div className="row">
            {b.status === "called" && <button onClick={() => setStatus(b.id, "in_service")}><Play size={16} /> Start service</button>}
            {b.status === "called" && <button className="warn" onClick={() => setStatus(b.id, "skipped")}><SkipForward size={16} /> Skip (no show)</button>}
            {b.status === "in_service" && <button onClick={() => setStatus(b.id, "completed")}><CheckCircle2 size={16} /> Mark completed</button>}
          </div>
        </div>
      ))}

      <h3>Waiting list</h3>
      {waiting.length === 0 && <p className="muted">The queue is empty.</p>}
      {waiting.length > 0 && (
        <div className="card scroll">
          <table>
            <thead><tr><th>#</th><th>Ticket</th><th>Student</th><th>Joined</th><th></th></tr></thead>
            <tbody>
              {waiting.map((b, i) => (
                <tr key={b.id}>
                  <td>{i + 1}</td>
                  <td>{b.ticket_number}</td>
                  <td>{b.student_name}<div className="muted">{b.matric_no}</div></td>
                  <td>{new Date(b.joined_at).toLocaleTimeString()}</td>
                  <td><button className="alt" onClick={() => setStatus(b.id, "skipped")}><X size={16} /> Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
