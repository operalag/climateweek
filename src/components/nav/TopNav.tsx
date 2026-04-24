import Link from "next/link";
import { CWZ } from "@/lib/constants";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/attendees", label: "Attendees" },
  { href: "/events", label: "Events" },
  { href: "/signals", label: "Signals" },
  { href: "/scoring", label: "Scoring" },
  { href: "/outreach", label: "Outreach" },
  { href: "/runs", label: "Runs" },
];

export function TopNav() {
  return (
    <header className="border-b" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-semibold">
            CWZ {CWZ.year}
          </Link>
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>
            Attendee Intelligence · {CWZ.startDate} → {CWZ.endDate}
          </span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover:opacity-100 opacity-80 transition"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
