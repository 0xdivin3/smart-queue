"use client";
import { useRouter } from "next/navigation";
import { supabase, Profile } from "@/lib/supabase";
import { LogOut, Ticket } from "lucide-react";

export default function Shell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div>
      <header className="bar">
        <b><Ticket size={18} className="ico" />Smart Queue Management System</b>
        <span>{profile.full_name} ({profile.role})</span>
        <button
          className="ghost"
          onClick={async () => { await supabase.auth.signOut(); router.replace(profile.role === "student" ? "/" : `/${profile.role}/login`); }}
        >
          <LogOut size={16} /> Log out
        </button>
      </header>
      <main className="wrap">{children}</main>
    </div>
  );
}
