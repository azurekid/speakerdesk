// Client-safe: turning another platform's attendee export into registrations. Column names
// differ per platform and per export, so columns are matched by common names and the organizer
// confirms (or fixes) the mapping in a preview before anything is saved.

export const IMPORT_PLATFORMS = [
  { id: "meetup", label: "Meetup", hint: "Meetup: Manage attendees, then download the attendee list. Meetup exports often have no email addresses; those people can still be checked in by name." },
  { id: "run.events", label: "run.events", hint: "run.events: export the registrations of your event as CSV." },
  { id: "csv", label: "Other (CSV)", hint: "Any spreadsheet saved as CSV, with a name column and ideally an email column." },
] as const;
export type ImportPlatform = (typeof IMPORT_PLATFORMS)[number]["id"];

export const IMPORT_FIELDS = ["name", "firstName", "lastName", "email", "company", "jobTitle"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  name: "Full name", firstName: "First name", lastName: "Last name", email: "Email", company: "Company", jobTitle: "Job title",
};

/** Lower-case header names we recognise for each field. */
const ALIASES: Record<ImportField, string[]> = {
  name: ["name", "full name", "fullname", "attendee name", "attendee", "member name", "participant", "guest name"],
  firstName: ["first name", "firstname", "given name", "voornaam"],
  lastName: ["last name", "lastname", "surname", "family name", "achternaam"],
  email: ["email", "e-mail", "email address", "e-mail address", "attendee email", "mail"],
  company: ["company", "organization", "organisation", "employer", "company name", "bedrijf"],
  jobTitle: ["job title", "title", "role", "position", "function", "jobtitle", "functie"],
};

export type Mapping = Partial<Record<ImportField, string>>; // field -> header

/** Best guess at which column holds which field. */
export function guessMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const norm = (h: string) => h.trim().toLowerCase().replace(/[_*]/g, " ").replace(/\s+/g, " ");
  for (const field of IMPORT_FIELDS) {
    const hit = headers.find((h) => ALIASES[field].includes(norm(h)));
    if (hit) mapping[field] = hit;
  }
  // "Title" alone is a job title only when there's a separate name column.
  if (mapping.jobTitle && norm(mapping.jobTitle) === "title" && !mapping.name && !mapping.firstName) delete mapping.jobTitle;
  return mapping;
}

export type ImportRow = { name: string; email: string; company: string; jobTitle: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Applies a mapping. Rows without a name (and without an email to derive one) are dropped. */
export function mapRows(rows: Record<string, string>[], mapping: Mapping): { rows: ImportRow[]; skipped: number } {
  const get = (r: Record<string, string>, f: ImportField) => (mapping[f] ? String(r[mapping[f]!] ?? "").trim() : "");
  const out: ImportRow[] = [];
  let skipped = 0;
  for (const r of rows) {
    const email = get(r, "email").toLowerCase();
    const name = get(r, "name") || [get(r, "firstName"), get(r, "lastName")].filter(Boolean).join(" ") || (EMAIL.test(email) ? email.split("@")[0] : "");
    if (!name) {
      skipped++;
      continue;
    }
    out.push({ name: name.slice(0, 150), email: EMAIL.test(email) ? email.slice(0, 254) : "", company: get(r, "company").slice(0, 150), jobTitle: get(r, "jobTitle").slice(0, 150) });
  }
  return { rows: out, skipped };
}
