"use client";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useState,
} from "react";
export async function api(path: string, method = "GET", data?: unknown) {
  const r = await fetch("/api/" + path, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error ?? "Request failed");
  return result;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [invalid, setInvalid] = useState("");
  const errorId = useId();
  return (
    <label
      className="field"
      onInput={() => setInvalid("")}
      onInvalidCapture={(e) =>
        setInvalid((e.target as HTMLInputElement).validationMessage)
      }
    >
      <span>{label}</span>
      {isValidElement(children)
        ? cloneElement(children as React.ReactElement<any>, {
            "aria-label": (children.props as any)["aria-label"] ?? label,
            "aria-invalid": invalid ? true : undefined,
            "aria-describedby": invalid ? errorId : undefined,
          })
        : children}
      {invalid && (
        <small id={errorId} className="field-error">
          {invalid}
        </small>
      )}
    </label>
  );
}
export function ErrorBox({ error }: { error: string }) {
  return error ? (
    <div role="alert" className="error">
      {error}
    </div>
  ) : null;
}
export function Copy({
  value,
  label = "Copy link",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <span className={copied ? "copy-success" : ""}>
      <button
        type="button"
        className="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            setError("Copy this link from the field below.");
          }
        }}
      >
        <span role="status">{copied ? "Copied!" : label}</span>
      </button>
      {error && <input aria-label="Link to copy" readOnly value={value} />}
    </span>
  );
}
export function when(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
export function money(value: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
    }).format(value / 100);
  } catch {
    return `${currency} ${(value / 100).toFixed(2)}`;
  }
}
export function Theme({ f }: { f: any }) {
  return f.themeEnabled ? (
    <div className="theme">
      <strong>
        {f.theme || "Theme & dress code"} · {f.guidance}
      </strong>
      <p>{f.outfit}</p>
      {f.colours && (
        <div className="colour-chips" aria-label="Suggested colours">
          {f.colours.split(/[,;]+/).map((c: string) => (
            <span key={c}>{c.trim()}</span>
          ))}
        </div>
      )}
    </div>
  ) : null;
}

export function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    Overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    Guests:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 8v6 M17 11h6",
    Invitation: "M3 5h18v14H3z M3 5l9 8 9-8",
    Budget: "M4 4h16v16H4z M8 8h8 M8 12h3 M8 16h8",
    Settings: "M4 7h16 M4 17h16 M9 4v6 M15 14v6",
  };
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.Invitation} />
    </svg>
  );
}
