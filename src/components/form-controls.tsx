"use client";

import { type ComponentProps, type FormEvent, type KeyboardEvent, startTransition, useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonVariant, cx } from "@/components/ui";

/**
 * useActionState for forms that must keep their input when the action returns errors.
 * React 19 resets a <form action={…}> after every submission; submitting via onSubmit avoids that.
 */
export function useFormAction<S>(action: (prev: Awaited<S>, form: FormData) => S | Promise<S>, initial: Awaited<S>) {
  const [state, dispatch, pending] = useActionState<S, FormData>(action, initial);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(() => dispatch(form));
  };
  return [state, onSubmit, pending] as const;
}

/** Character counter that turns amber near the limit and red over it. */
export function CharCount({ value, limit }: { value: string; limit?: number }) {
  const n = value.length;
  if (!limit) return <span className="text-xs tabular-nums text-neutral-400">{n.toLocaleString()} chars</span>;
  const over = n > limit;
  const near = !over && n > limit * 0.9;
  return (
    <span className={cx("text-xs tabular-nums", over ? "font-medium text-rose-700" : near ? "text-amber-700" : "text-neutral-400")}>
      {n.toLocaleString()} / {limit.toLocaleString()}
      {over && ` (${(n - limit).toLocaleString()} over)`}
    </span>
  );
}

type CountedProps = Omit<ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> & {
  label: string;
  name: string;
  defaultValue?: string;
  limit?: number;
  hint?: string;
  error?: string[];
};

/** Textarea with a live character counter. `limit` is a soft target, not enforced. */
export function CountedTextarea({ label, name, defaultValue = "", limit, hint, error, rows = 4, className, ...rest }: CountedProps) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  return (
    <div className={className}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
        <CharCount value={value} limit={limit} />
      </div>
      <textarea
        id={id}
        name={name}
        rows={rows}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={error?.length ? true : undefined}
        className="control resize-y"
        {...rest}
      />
      {error?.length ? <p className="mt-1 text-xs text-rose-700">{error[0]}</p> : hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

/** Free-form tags as chips; submits one hidden input per tag. */
export function TagInput({ name, defaultValue = [], suggestions = [], placeholder = "Add a tag and press Enter", lowercase = true, prefix = "#" }: { name: string; defaultValue?: string[]; suggestions?: string[]; placeholder?: string; lowercase?: boolean; prefix?: string }) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");
  const listId = useId();

  const add = (raw: string) => {
    const parts = raw.split(",").map((t) => (lowercase ? t.trim().toLowerCase() : t.trim())).filter(Boolean);
    if (parts.length) setTags((prev) => [...new Set([...prev, ...parts])].slice(0, 30));
    setDraft("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && tags.length) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  return (
    <div className="control flex flex-wrap items-center gap-1.5 py-1.5">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded bg-neutral-100 py-0.5 pl-2 pr-1 text-xs text-ink">
          {prefix}{t}
          <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="rounded px-1 hover:bg-neutral-200" aria-label={`Remove ${t}`}>×</button>
          <input type="hidden" name={name} value={t} />
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => draft && add(draft)}
        list={suggestions.length ? listId : undefined}
        placeholder={tags.length ? "" : placeholder}
        className="min-w-32 flex-1 border-0 bg-transparent p-0.5 text-sm outline-none focus:ring-0"
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.filter((s) => !tags.includes(s)).map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  );
}

/** Ordered list of short strings (e.g. key takeaways); submits one hidden input per item. */
export function ListInput({ name, defaultValue = [], max = 5, placeholder, addLabel = "+ Add takeaway" }: { name: string; defaultValue?: string[]; max?: number; placeholder?: string; addLabel?: string }) {
  const [items, setItems] = useState<string[]>(defaultValue.length ? defaultValue : [""]);
  const update = (i: number, v: string) => setItems(items.map((x, j) => (j === i ? v : x)));
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 text-right text-xs tabular-nums text-neutral-400">{i + 1}.</span>
          <input name={name} value={item} onChange={(e) => update(i, e.target.value)} placeholder={placeholder} className="control" maxLength={500} />
          <button type="button" onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== i) : [""])} className={buttonClass("ghost", "sm")} aria-label="Remove">×</button>
        </div>
      ))}
      {items.length < max && (
        <button type="button" onClick={() => setItems([...items, ""])} className={buttonClass("ghost", "sm")}>{addLabel}</button>
      )}
    </div>
  );
}

export function SubmitButton({ children, variant = "primary", pendingLabel = "Saving…", pending: pendingProp }: { children: React.ReactNode; variant?: ButtonVariant; pendingLabel?: string; pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant)}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      disabled={!text}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={cx(buttonClass("secondary", "sm"), className)}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

export function FormMessage({ state }: { state?: { ok?: boolean; message?: string } }) {
  if (!state?.message) return null;
  return (
    <p role="status" className={cx("rounded-lg px-3 py-2 text-sm", state.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-800")}>
      {state.message}
    </p>
  );
}

/** A button that runs a server action after an optional confirm() prompt. */
export function ActionButton({ action, children, confirmText, variant = "secondary" }: { action: () => Promise<void>; children: React.ReactNode; confirmText?: string; variant?: ButtonVariant }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <SubmitButton variant={variant} pendingLabel="Working…">{children}</SubmitButton>
    </form>
  );
}
