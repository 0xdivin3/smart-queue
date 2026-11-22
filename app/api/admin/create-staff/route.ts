import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-only route: an admin creates a staff account.
// Uses the service role key, which must never be exposed to the browser.
export async function POST(req: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "Server is missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Confirm the caller is a signed-in admin
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await admin.from("profiles").select("role").eq("id", u.user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  // 2. Validate input
  const { full_name, email, password, office_id } = await req.json();
  if (!full_name || !email || !office_id || !password || password.length < 6) {
    return NextResponse.json({ error: "Name, email, office and a password of 6+ characters are required" }, { status: 400 });
  }

  // 3. Create the auth user, then promote the auto-created profile to staff
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { error: e2 } = await admin.from("profiles").update({ role: "staff", office_id }).eq("id", data.user.id);
  if (e2) {
    await admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: e2.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
