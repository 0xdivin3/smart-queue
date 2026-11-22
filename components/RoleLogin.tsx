"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function RoleLogin({ role }: { role: "admin" | "staff" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      return setMsg(error.message);
    }
    const { data: p } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    if (p?.role !== role) {
      await supabase.auth.signOut();
      setBusy(false);
      return setMsg(`This account is not a ${role} account.`);
    }
    router.replace("/" + role);
  }

  return (
    <div className="auth">
      <h1><ShieldCheck size={26} className="ico" />{role === "admin" ? "Admin" : "Staff"} login</h1>
      <form className="card" onSubmit={submit}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {msg && <p className="err">{msg}</p>}
        <div className="row">
          <button disabled={busy}><LogIn size={16} /> {busy ? "Please wait..." : "Log in"}</button>
          <a href="/login" className="muted">Student login</a>
        </div>
      </form>
    </div>
  );
}
