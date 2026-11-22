import {
  Ticket, UserPlus, ListOrdered, BellRing, Megaphone, BarChart3, ShieldCheck, Clock, Users,
} from "lucide-react";

const steps = [
  { icon: UserPlus, title: "Register", text: "Create a student account with your matric number." },
  { icon: ListOrdered, title: "Join a queue", text: "Pick an office and service from your phone and get a ticket number." },
  { icon: Clock, title: "Track your place", text: "See your live position and estimated waiting time." },
  { icon: BellRing, title: "Get notified", text: "Receive an alert when your turn is near and when you are called." },
];

const features = [
  { icon: Ticket, title: "Digital tickets", text: "Numbered tickets per service (for example PAY-012) that reset every day." },
  { icon: Clock, title: "Wait estimates", text: "Estimated waiting time based on each service's average handling time." },
  { icon: Megaphone, title: "Staff console", text: "Call the next student, start service, complete or skip no-shows." },
  { icon: BarChart3, title: "Admin reports", text: "Daily totals, completed, skipped and cancelled tickets, with average wait and service times." },
  { icon: Users, title: "Offices and services", text: "Admins add offices and services and issue staff accounts." },
  { icon: ShieldCheck, title: "Role-based access", text: "Students, staff and admins each see only what they are allowed to." },
];

export default function Landing() {
  return (
    <div>
      <header className="bar">
        <b><Ticket size={18} className="ico" />Smart Queue</b>
        <div className="row">
          <a className="btn ghostlink" href="/staff/login">Staff</a>
          <a className="btn ghostlink" href="/admin/login">Admin</a>
        </div>
      </header>

      <section className="hero">
        <div className="wrap">
          <h1>Stop standing in line at university offices.</h1>
          <p>
            A smart queue management system that lets students join a queue online, follow their
            position in real time and be called when it is their turn.
          </p>
          <div className="row" style={{ justifyContent: "flex-start" }}>
            <a className="btn" href="/login">Student login or register</a>
            <a className="btn alt" href="#how">How it works</a>
          </div>
        </div>
      </section>

      <main className="wrap">
        <h2 id="how">How it works</h2>
        <div className="grid">
          {steps.map((s, i) => (
            <div className="card" key={s.title}>
              <s.icon size={24} color="#0f3d73" />
              <h3>{i + 1}. {s.title}</h3>
              <p className="muted">{s.text}</p>
            </div>
          ))}
        </div>

        <h2>Features</h2>
        <div className="grid">
          {features.map((f) => (
            <div className="card" key={f.title}>
              <f.icon size={24} color="#0f3d73" />
              <h3>{f.title}</h3>
              <p className="muted">{f.text}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="wrap muted" style={{ textAlign: "center" }}>
        Final year project: Design and implementation of a smart queue management system for university offices.
      </footer>
    </div>
  );
}
