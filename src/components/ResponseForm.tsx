"use client";
import { useEffect, useRef, useState } from "react";
import { api, Field, ErrorBox, Theme } from "./common";
export default function ResponseForm({
  event,
  household,
  endpoint,
  method = "POST",
  host = false,
  onSaved,
}: {
  event: any;
  household?: any;
  endpoint: string;
  method?: string;
  host?: boolean;
  onSaved: (result: any) => void;
}) {
  const [data, setData] = useState<any>(() => ({
    version: household?.version ?? 0,
    requestKey: crypto.randomUUID(),
    name: household?.name ?? "",
    contact: household?.contact ?? "",
    email: household?.email ?? "",
    phone: household?.phone ?? "",
    notes: household?.notes ?? "",
    source: host ? "Host" : "Guest",
    statuses: event.functions.map((f: any) => ({
      functionId: f.id,
      status:
        household?.attendance.find(
          (a: any) => a.functionId === f.id && !a.memberId,
        )?.status ?? "Unsure",
    })),
    members:
      household?.members.map((m: any) => ({
        ...m,
        functionIds: household.attendance
          .filter((a: any) => a.memberId === m.id && a.status === "Attending")
          .map((a: any) => a.functionId),
      })) ?? [],
  }));
  const [step, setStep] = useState(host ? 2 : 0);
  const [samePeople, setSamePeople] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step) {
      heading.current?.focus();
      previousStep.current = step;
    }
  }, [step]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const attending = data.statuses
    .filter((s: any) => s.status === "Attending")
    .map((s: any) => s.functionId);
  const patch = (k: string, v: any) => setData((d: any) => ({ ...d, [k]: v }));
  return (
    <form
      className="card response-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!host && step < 2) {
          if (
            step === 1 &&
            attending.some(
              (id: string) =>
                !data.members.some((m: any) => m.functionIds.includes(id)),
            )
          ) {
            setError("Add at least one person for every attending function.");
            return;
          }
          setError("");
          setStep(step === 0 && !attending.length ? 2 : step + 1);
          return;
        }
        setBusy(true);
        setError("");
        try {
          const payload = {
            ...data,
            members: attending.length
              ? data.members.map((m: any) => ({
                  ...m,
                  functionIds: m.functionIds.filter((id: string) =>
                    attending.includes(id),
                  ),
                }))
              : [],
          };
          onSaved(await api(endpoint, method, payload));
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 ref={heading} tabIndex={-1}>
        {host ? "Record a household response" : "Your household response"}
      </h2>
      {!host && (
        <ol className="stepper" aria-label="Response progress">
          {["Are you coming?", "Who is coming?", "Review & confirm"].map(
            (label, i) => (
              <li key={label} aria-current={step === i ? "step" : undefined}>
                <span>{i + 1}</span>
                {label}
              </li>
            ),
          )}
        </ol>
      )}
      <ErrorBox error={error} />
      {household?.maxPeople && (
        <p className="notice">
          This invitation is for up to {household.maxPeople} people, including
          the main contact.
        </p>
      )}
      <div hidden={!host && step !== 0}>
        <div className="grid two">
          <Field label="Main contact name">
            <input
              required={host || step === 0}
              value={data.contact}
              maxLength={200}
              onChange={(e) => patch("contact", e.target.value)}
            />
          </Field>
          <Field label="Household / family name">
            <input
              required={host || step === 0}
              value={data.name}
              maxLength={200}
              onChange={(e) => patch("name", e.target.value)}
            />
          </Field>
          <Field label="Email (optional)">
            <input
              type="email"
              value={data.email}
              onChange={(e) => patch("email", e.target.value)}
            />
          </Field>
          <Field label="Phone (optional)">
            <input
              type="tel"
              maxLength={50}
              value={data.phone}
              onChange={(e) => patch("phone", e.target.value)}
            />
          </Field>
        </div>
        <h3>Attendance per function</h3>
        {event.functions.map((f: any) => (
          <div className="inset" key={f.id}>
            <Field label={f.name}>
              <select
                aria-label={`Attendance for ${f.name}`}
                value={
                  data.statuses.find((s: any) => s.functionId === f.id).status
                }
                onChange={(e) => {
                  const status = e.target.value;
                  patch(
                    "statuses",
                    data.statuses.map((s: any) =>
                      s.functionId === f.id ? { ...s, status } : s,
                    ),
                  );
                }}
              >
                <option>Attending</option>
                <option>Unable to attend</option>
                <option>Unsure</option>
              </select>
            </Field>
            <Theme f={f} />
          </div>
        ))}
      </div>
      <div hidden={!host && step !== 1}>
        {attending.length > 0 && (
          <>
            <h3>Everyone attending, including you</h3>
            <p>
              Enter one member per person. Total attending, including you, is
              calculated from these entries.
            </p>
            {event.functions.length > 1 && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={samePeople}
                  onChange={(e) => {
                    setSamePeople(e.target.checked);
                    if (e.target.checked)
                      patch(
                        "members",
                        data.members.map((m: any) => ({
                          ...m,
                          functionIds: [...attending],
                        })),
                      );
                  }}
                />
                Same people attending every function
              </label>
            )}
            <p className="muted">
              You can select per-function exceptions below.
            </p>
            {data.members.map((m: any, i: number) => (
              <fieldset key={i}>
                <legend>Member {i + 1}</legend>
                <div className="grid three">
                  <Field label="Member name">
                    <input
                      required={host || step === 0}
                      value={m.name}
                      maxLength={200}
                      onChange={(e) =>
                        patch(
                          "members",
                          data.members.map((n: any, j: number) =>
                            i === j ? { ...n, name: e.target.value } : n,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Adult or child">
                    <select
                      value={m.category}
                      onChange={(e) =>
                        patch(
                          "members",
                          data.members.map((n: any, j: number) =>
                            i === j ? { ...n, category: e.target.value } : n,
                          ),
                        )
                      }
                    >
                      <option>Adult</option>
                      <option>Child</option>
                    </select>
                  </Field>
                  <Field label="Dietary preference (optional)">
                    <select
                      value={m.diet}
                      onChange={(e) =>
                        patch(
                          "members",
                          data.members.map((n: any, j: number) =>
                            i === j ? { ...n, diet: e.target.value } : n,
                          ),
                        )
                      }
                    >
                      {[
                        "",
                        "Vegetarian",
                        "Non-vegetarian",
                        "Jain",
                        "Vegan",
                        "Other",
                      ].map((d) => (
                        <option key={d} value={d}>
                          {d || "No preference"}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <p>Attending:</p>
                {event.functions
                  .filter((f: any) => attending.includes(f.id))
                  .map((f: any) => (
                    <label className="check" key={f.id}>
                      <input
                        type="checkbox"
                        checked={m.functionIds.includes(f.id)}
                        onChange={(e) =>
                          patch(
                            "members",
                            data.members.map((n: any, j: number) =>
                              i === j
                                ? {
                                    ...n,
                                    functionIds: e.target.checked
                                      ? [...n.functionIds, f.id]
                                      : n.functionIds.filter(
                                          (id: string) => id !== f.id,
                                        ),
                                  }
                                : n,
                            ),
                          )
                        }
                      />
                      {f.name}
                    </label>
                  ))}
                <button
                  className="text-button danger"
                  type="button"
                  onClick={() =>
                    patch(
                      "members",
                      data.members.filter((_: any, j: number) => j !== i),
                    )
                  }
                >
                  Remove member
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              className="secondary"
              disabled={
                !!household?.maxPeople &&
                data.members.length >= household.maxPeople
              }
              onClick={() =>
                patch("members", [
                  ...data.members,
                  {
                    name: "",
                    category: "Adult",
                    diet: "",
                    functionIds: [...attending],
                  },
                ])
              }
            >
              + Add family member / yourself
            </button>
            <div className="notice">
              {event.functions
                .filter((f: any) => attending.includes(f.id))
                .map((f: any) => (
                  <p key={f.id}>
                    {f.name} — Total attending, including you:{" "}
                    {
                      data.members.filter((m: any) =>
                        m.functionIds.includes(f.id),
                      ).length
                    }
                  </p>
                ))}
            </div>
          </>
        )}
      </div>
      <div hidden={!host && step !== 2}>
        {!host && (
          <div className="response-review">
            <h3>{data.name}</h3>
            <p>Main contact: {data.contact}</p>
            {event.functions.map((f: any) => (
              <p key={f.id}>
                <strong>{f.name}</strong> ·{" "}
                {data.statuses.find((s: any) => s.functionId === f.id)?.status}
                <br />
                {attending.includes(f.id)
                  ? data.members
                      .filter((m: any) => m.functionIds.includes(f.id))
                      .map((m: any) => `${m.name} (${m.category})`)
                      .join(", ")
                  : "No people confirmed"}
              </p>
            ))}
          </div>
        )}
        <Field label="Notes (optional)">
          <textarea
            maxLength={3000}
            value={data.notes}
            onChange={(e) => patch("notes", e.target.value)}
          />
        </Field>
        {host && (
          <Field label="Response source">
            <select
              value={data.source}
              onChange={(e) => patch("source", e.target.value)}
            >
              <option>Host</option>
              <option>Confirmed by phone</option>
            </select>
          </Field>
        )}
        <button disabled={busy} type="submit">
          {busy
            ? "Saving…"
            : household?.responded
              ? "Save response changes"
              : "Save response"}
        </button>
      </div>
      {!host && (
        <div className="actions wizard-controls">
          {step > 0 && (
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setStep(step === 2 && !attending.length ? 0 : step - 1);
                setError("");
              }}
            >
              Back
            </button>
          )}
          {step < 2 && <button type="submit">Continue</button>}
        </div>
      )}
      <p>
        <small>
          {host
            ? "Your manual changes are recorded in history and do not notify you by email."
            : "Your response is shared with the event host."}
        </small>
      </p>
    </form>
  );
}
