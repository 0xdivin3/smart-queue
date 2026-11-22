# Smart Queue Management System for University Offices

Next.js (TypeScript) + Supabase (PostgreSQL, Auth). Three roles: student, staff, admin.

## Setup

1. Create a project at supabase.com.
2. Authentication > Providers > Email: turn OFF "Confirm email" (easier for demos and testing).
3. SQL Editor: run `supabase/01_schema.sql`, then `supabase/02_logic.sql`.
4. Project Settings > API: copy the Project URL, the anon public key and the service_role secret key.
5. Locally: copy `.env.example` to `.env.local`, fill in all three values, then `npm install` and `npm run dev`.
6. Push to GitHub, import the repo in Vercel, and add the same three variables (the service_role key must NOT start with NEXT_PUBLIC) under Settings > Environment Variables BEFORE the first deploy.

## First admin

Register an account in the app, then run in the SQL editor:

    update profiles set role = 'admin' where email = 'your@email.com';

Then open `/admin/login` and log in. (Staff use `/staff/login`; students use `/login`; the home page `/` is the public landing page.) From the Admin page > Users, use "Create staff account" to issue staff logins (name, email, temporary password, office).

## Test flow

1. Student account A and B register and join the same service.
2. Staff (assigned to that office) clicks "Call next student"; the student page shows the notification.
3. Staff: Start service, then Mark completed.
4. Admin: open Reports to see wait and service times.
