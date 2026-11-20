import { cx } from "@/components/ui";
import type { BudgetSummary } from "@/lib/budget";
import { formatMoney } from "@/lib/domain";

/** Segmented progress towards the budget target: other income, paid, confirmed, then the open pipeline. */
export function BudgetBar({ b, currency, compact }: { b: BudgetSummary; currency: string; compact?: boolean }) {
  const scale = Math.max(b.target ?? 0, b.secured + b.pipeline, 1);
  const pct = (n: number) => `${(n / scale) * 100}%`;
  const segments = [
    { key: "other", value: b.other, className: "bg-neutral-400", label: "Other income" },
    { key: "paid", value: b.paid, className: "bg-emerald-600", label: "Paid" },
    { key: "confirmed", value: b.confirmed, className: "bg-emerald-400", label: "Confirmed" },
    { key: "pipeline", value: b.pipeline, className: "bg-[repeating-linear-gradient(45deg,#fdba74_0_6px,#fed7aa_6px_12px)]", label: "Requested" },
  ];
  const reached = b.target !== null && b.secured >= b.target;
  return (
    <div>
      {!compact && (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm text-ink-soft">Secured</p>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {formatMoney(b.secured, currency)}
              {b.target !== null && <span className="text-base font-normal text-ink-soft"> of {formatMoney(b.target, currency)}</span>}
            </p>
          </div>
          {b.target !== null && (
            <p className={cx("rounded-full px-3 py-1 text-sm font-medium", reached ? "bg-emerald-50 text-emerald-800" : "bg-neutral-100 text-ink")}>
              {reached ? "Budget reached 🎉" : `${formatMoney(b.remaining ?? 0, currency)} to go · ${Math.round((b.pct ?? 0) * 100)}%`}
            </p>
          )}
        </div>
      )}
      <div className="relative h-3 overflow-hidden rounded-full bg-neutral-100">
        <div className="flex h-full">
          {segments.map((s) => s.value > 0 && <div key={s.key} className={s.className} style={{ width: pct(s.value) }} title={`${s.label}: ${formatMoney(s.value, currency)}`} />)}
        </div>
        {b.target !== null && b.target < scale && <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: pct(b.target) }} title="Target" />}
      </div>
      {!compact && (
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft">
          {segments.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className={cx("size-2.5 rounded-sm", s.className)} />
              {s.label} <span className="font-medium tabular-nums text-ink">{formatMoney(s.value, currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
