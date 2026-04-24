import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/nav/TopNav";
import { CWZ } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Climate Week Zurich ${CWZ.year} — Attendee Intelligence`,
  description:
    "Discover, enrich, score and monitor every organization and individual attending Climate Week Zurich.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TopNav />
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
