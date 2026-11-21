// Client-safe: the event setup steps, in order. Settings is a guided flow rather than one long
// form: each step has its own page and form, and "Save and continue" moves to the next one.

export const SETUP_STEPS = [
  { id: "details", label: "Event details", hint: "Name, dates and where it happens", path: "" },
  { id: "cover", label: "Banner", hint: "The photo on your event page and link previews", path: "/cover" },
  { id: "cfp", label: "Call for papers", hint: "Dates, tracks, formats and rules", path: "/cfp" },
  { id: "registration", label: "Registration and tickets", hint: "Ticket types, capacity, sponsor sharing", path: "/registration" },
  { id: "emails", label: "Emails", hint: "What speakers get when they submit and when you decide", path: "/emails" },
] as const;

export type SetupStepId = (typeof SETUP_STEPS)[number]["id"];

export const settingsPath = (eventId: string, step: SetupStepId) => `/organize/${eventId}/settings${SETUP_STEPS.find((s) => s.id === step)!.path}`;

/** The step after this one, or null at the end of the flow. */
export function nextStep(step: SetupStepId): SetupStepId | null {
  const i = SETUP_STEPS.findIndex((s) => s.id === step);
  return SETUP_STEPS[i + 1]?.id ?? null;
}
