"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LogIn, UserPlus } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [f, setF] = useState({ email: "", password: "", full_name: "", matric_no: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function goToDashboard(userId: string) {
    const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
    router.replace("/" + (data?.role ?? "student"));
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) goToDashboard(session.user.id);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email: f.email, password: f.password })
        : await supabase.auth.signUp({
            email: f.email,
            password: f.password,
            options: { data: { full_name: f.full_name, matric_no: f.matric_no } },
          });
    setBusy(false);
    if (res.error) return setMsg(res.error.message);
    if (!res.data.session) return setMsg("Check your email to confirm your account, then log in.");
    goToDashboard(res.data.session.user.id);
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="auth">
      <h1>Smart Queue</h1>
      <p className="muted">Join university office queues from your phone and get notified when it is your turn.</p>
      <form className="card" onSubmit={submit}>
        <h3>{mode === "login" ? "Log in" : "Create student account"}</h3>
        {mode === "register" && (
          <>
            <input placeholder="Full name" value={f.full_name} onChange={set("full_name")} required />
            <input placeholder="Matric number" value={f.matric_no} onChange={set("matric_no")} required />
          </>
        )}
        <input type="email" placeholder="Email" value={f.email} onChange={set("email")} required />
        <input type="password" placeholder="Password (min 6 characters)" value={f.password} onChange={set("password")} minLength={6} required />
        {msg && <p className="err">{msg}</p>}
        <div className="row">
          <button disabled={busy}>{mode === "login" ? <LogIn size={16} /> : <UserPlus size={16} />}{busy ? "Please wait..." : mode === "login" ? "Log in" : "Register"}</button>
          <button type="button" className="alt" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMsg(""); }}>
            {mode === "login" ? "New student? Register" : "Have an account? Log in"}
          </button>
        </div>
      </form>
      <p className="muted"><a href="/staff/login">Staff login</a> | <a href="/admin/login">Admin login</a></p>
    </div>
  );
}
