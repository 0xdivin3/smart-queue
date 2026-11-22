import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Role = "student" | "staff" | "admin";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  matric_no: string | null;
  role: Role;
  office_id: string | null;
};
