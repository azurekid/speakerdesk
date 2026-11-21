import { SETUP_STEPS, type SetupStepId } from "@/lib/event-setup";

/** Title of a setup step: "Step 2 of 5 · Banner" with one line about it. */
export function StepHeader({ step, note }: { step: SetupStepId; note?: React.ReactNode }) {
  const i = SETUP_STEPS.findIndex((s) => s.id === step);
  const s = SETUP_STEPS[i];
  return (
    <div className="mb-6">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-700">Step {i + 1} of {SETUP_STEPS.length}</p>
      <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">{s.label}</h2>
      <p className="mt-1 text-sm text-ink-soft">{s.hint}.</p>
      {note}
    </div>
  );
}
