import type { ReactNode } from "react";
import { LEGAL_UPDATED, TERMS_VERSION } from "@/lib/legal";

/** Readable long-form text for the legal pages (no typography plugin needed). */
export function LegalDoc({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <article className="space-y-8 leading-relaxed [&_a]:underline [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_li]:mt-1 [&_p+p]:mt-3 [&_table]:w-full [&_table]:text-sm [&_td]:border-t [&_td]:border-line [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top [&_th]:pb-2 [&_th]:pr-4 [&_th]:text-left [&_th]:font-medium [&_ul]:list-disc [&_ul]:pl-5">
      <header>
        <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-ink-soft">Version {TERMS_VERSION} · last updated {LEGAL_UPDATED}</p>
        <div className="mt-6 text-lg text-ink-soft">{intro}</div>
      </header>
      {children}
    </article>
  );
}

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
