import type { Metadata } from "next";
import { buttonClass, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Export" };

const EXPORTS = [
  { href: "/api/export/json", title: "Full backup (JSON)", body: "Profile, sessions and submissions. Re-import it here any time, or use it in your own tooling." },
  { href: "/api/export/markdown", title: "Speaker kit (Markdown)", body: "Bio, links and all active sessions in one document — ready to email to an organizer or convert to PDF." },
  { href: "/api/export/csv", title: "Sessions (CSV)", body: "One row per session for spreadsheets. The same columns are accepted by the CSV importer." },
];

export default function ExportPage() {
  return (
    <>
      <PageHeader eyebrow="Press kit" title="Export" description="Your data is yours. Download it in the format you need." />
      <div className="grid gap-4">
        {EXPORTS.map((e) => (
          <Card key={e.href}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-ink">{e.title}</h2>
                <p className="mt-0.5 text-sm text-ink-soft">{e.body}</p>
              </div>
              <a href={e.href} className={buttonClass("secondary")} download>Download</a>
            </div>
          </Card>
        ))}
        <p className="text-xs text-ink-soft">Single sessions can be exported as Markdown from each session page.</p>
      </div>
    </>
  );
}
