"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, Profile, Role } from "./supabase";

// Loads the signed-in user's profile and redirects if the role does not match.
export function useProfile(required?: Role) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace("/");
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (!data) return router.replace("/");
      if (required && data.role !== required) return router.replace("/" + data.role);
      setProfile(data as Profile);
    })();
  }, []);

  return profile;
}
