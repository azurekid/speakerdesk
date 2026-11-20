import { COMMITTED_STATUSES, type SponsorshipStatus } from "@/lib/domain";

type Deal = { status: SponsorshipStatus; items: { price: number }[] };

export type BudgetSummary = {
  target: number | null;
  other: number;
  paid: number;
  confirmed: number; // approved + invoiced, not yet paid
  pipeline: number;  // requested, not yet decided
  secured: number;   // other + paid + confirmed
  remaining: number | null;
  pct: number | null; // secured / target
};

export const dealValue = (d: { items: { price: number }[] }) => d.items.reduce((n, i) => n + i.price, 0);

export function summarizeBudget(target: number | null, otherIncome: number, deals: Deal[]): BudgetSummary {
  const sum = (pred: (s: SponsorshipStatus) => boolean) => deals.filter((d) => pred(d.status)).reduce((n, d) => n + dealValue(d), 0);
  const paid = sum((s) => s === "PAID");
  const confirmed = sum((s) => COMMITTED_STATUSES.includes(s) && s !== "PAID");
  const pipeline = sum((s) => s === "APPLIED");
  const secured = otherIncome + paid + confirmed;
  return {
    target,
    other: otherIncome,
    paid,
    confirmed,
    pipeline,
    secured,
    remaining: target === null ? null : Math.max(0, target - secured),
    pct: target ? secured / target : null,
  };
}
