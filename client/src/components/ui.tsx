import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../lib/cx";
import { IconBookOpen, IconCheckCircle, IconCircle, IconUser } from "../lib/icons";
import type { PaperStatus } from "../types";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-white shadow-card hover:bg-primary-hover active:bg-primary-press disabled:hover:bg-primary",
  secondary:
    "border border-line-strong bg-surface text-ink hover:bg-surface-muted hover:border-line-strong",
  ghost: "text-ink-muted hover:bg-surface-muted hover:text-ink",
  danger: "text-danger hover:bg-danger-soft",
  accent: "bg-accent text-white shadow-card hover:brightness-[0.96]",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-[0.8125rem]",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-[0.95rem]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type === "submit" || type === "reset" ? type : "button"}
      className={cx(
        "inline-flex select-none items-center justify-center rounded-lg font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  label: string;
}

export function IconButton({
  variant = "ghost",
  size = "md",
  label,
  className,
  type,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type === "submit" || type === "reset" ? type : "button"}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-lg transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        size === "sm" ? "h-8 w-8 text-[1.05rem]" : "h-10 w-10 text-[1.2rem]",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface-sunken p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-[0.4rem] px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
              active ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Avatar({
  src,
  name,
  size = 32,
  className,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = (name?.trim()?.[0] ?? "").toUpperCase();
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-primary-ink ring-1 ring-line",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {src ? (
        <img
          src={src}
          alt={name ?? "avatar"}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : initial ? (
        <span className="font-semibold">{initial}</span>
      ) : (
        <IconUser className="text-[1.1em] text-primary" />
      )}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-line/70", className)} />;
}

const STATUS_META: Record<PaperStatus, { label: string; icon: ReactNode; cls: string }> = {
  unread: {
    label: "未読",
    icon: <IconCircle />,
    cls: "bg-surface-muted text-ink-muted ring-line",
  },
  reading: {
    label: "読書中",
    icon: <IconBookOpen />,
    cls: "bg-accent-soft text-accent-ink ring-accent/25",
  },
  read: {
    label: "読了",
    icon: <IconCheckCircle />,
    cls: "bg-success-soft text-success ring-success/25",
  },
};

export function StatusBadge({ status, className }: { status: PaperStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium ring-1 ring-inset",
        m.cls,
        className,
      )}
    >
      <span className="text-[0.85em]">{m.icon}</span>
      {m.label}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted text-[1.6rem] text-ink-faint ring-1 ring-line">
        {icon}
      </div>
      <h3 className="text-[0.95rem] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
