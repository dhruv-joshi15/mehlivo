"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, Field, ErrorBox } from "./common";
const blankFunction = () => ({
  name: "Celebration",
  startsAt: "",
  venue: "",
  address: "",
  mapUrl: "",
  themeEnabled: false,
  theme: "",
  outfit: "",
  colours: "",
  guidance: "Suggested",
  catering: false,
  currency: "INR",
  adultRate: 0,
  childRate: null,
  fixed: 0,
  budget: null,
  buffer: 0,
});
function localDate(iso: string, zone: string) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
  return parts.replace(" ", "T");
}
function utcDate(local: string, zone: string) {
  if (!local) return null;
  let guess = new Date(local + "Z").getTime();
  for (let i = 0; i < 3; i++) {
    const formatted = localDate(new Date(guess).toISOString(), zone);
    guess +=
      new Date(local + "Z").getTime() - new Date(formatted + "Z").getTime();
  }
  return new Date(guess).toISOString();
}
export default function EventEditor({ id }: { id?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (dirty) document.getElementById("setup-step-title-" + step)?.focus();
  }, [step]);
  const [data, setData] = useState<any>({
    type: "Wedding",
    title: "",
    names: "",
    timezone: "Asia/Kolkata",
    welcome: "",
    expected: 0,
    deadline: "",
    published: false,
    notify: true,
    functions: [blankFunction()],
  });
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (id) {
      setLoading(true);
      api("events/" + id)
        .then((e) => {
          if (active)
            setData({
              ...e,
              notify: e.preference?.enabled !== false,
              deadline: e.deadline ? localDate(e.deadline, e.timezone) : "",
              functions: e.functions.map((f: any) => ({
                ...f,
                startsAt: localDate(f.startsAt, e.timezone),
              })),
            });
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [id]);
  const patch = (key: string, value: any) => {
    setDirty(true);
    setData((d: any) => ({ ...d, [key]: value }));
  };
  const update = (i: number, key: string, value: any) => {
    setDirty(true);
    setData((d: any) => ({
      ...d,
      functions: d.functions.map((f: any, n: number) =>
        n === i ? { ...f, [key]: value } : f,
      ),
    }));
  };
  if (loading) return <p>Loading event…</p>;
  return (
    <>
      <Link href={id ? "/host/events/" + id : "/host"}>← Back</Link>
      <div className="page-head">
        <div>
          <p className="eyebrow">Make room for a celebration</p>
          <h1>{id ? "Edit event" : "Create an event"}</h1>
          <p>
            Save a draft while you plan. Publish when you’re ready to invite
            guests.
          </p>
        </div>
      </div>
      <ol className="stepper" aria-label="Setup progress">
        {["The occasion", "When and where", "Preview and publish"].map(
          (label, i) => (
            <li key={label} aria-current={step === i ? "step" : undefined}>
              <span>{i + 1}</span>
              {label}
            </li>
          ),
        )}
      </ol>
      <p className="muted" role="status">
        {dirty
          ? "Unsaved changes · Your entries stay here as you move between steps."
          : id
            ? "Saved event loaded. Changes are saved when you finish."
            : "Your celebration starts here. Save when you’re ready."}
      </p>
      <ErrorBox error={error} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (step < 2) {
            setStep(step + 1);
            window.scrollTo({ top: 0, behavior: "instant" });
            return;
          }
          setBusy(true);
          setError("");
          try {
            const payload = {
              ...data,
              deadline: utcDate(data.deadline, data.timezone),
              functions: data.functions.map((f: any) => ({
                ...f,
                startsAt: utcDate(f.startsAt, data.timezone),
              })),
            };
            const event = await api(
              "events" + (id ? "/" + id : ""),
              id ? "PUT" : "POST",
              payload,
            );
            router.push("/host/events/" + event.id);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <section className="card" hidden={step !== 0}>
          <h2 id="setup-step-title-0" tabIndex={-1}>
            The occasion
          </h2>
          <div className="grid two">
            <Field label="Event type">
              <select
                value={data.type}
                onChange={(e) => patch("type", e.target.value)}
              >
                {[
                  "Wedding",
                  "Birthday",
                  "Anniversary",
                  "House party",
                  "Small gathering",
                  "Corporate event",
                  "Other",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Host / couple / celebrant names">
              <input
                required={step === 0}
                value={data.names}
                maxLength={200}
                onChange={(e) => patch("names", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Event title">
            <input
              required={step === 0}
              value={data.title}
              maxLength={200}
              onChange={(e) => patch("title", e.target.value)}
            />
          </Field>
          <div className="suggestions">
            <small>Try a title, then edit it:</small>
            {[
              `${data.names || "Your names"} · Together Begins Here`,
              `A Toast to ${data.names || "You"}`,
              "An Evening Together",
            ].map((t) => (
              <button
                className="text-button"
                type="button"
                key={t}
                onClick={() => patch("title", t)}
              >
                {t}
              </button>
            ))}
          </div>
          <Field label="Welcome message (optional)">
            <textarea
              maxLength={3000}
              value={data.welcome}
              onChange={(e) => patch("welcome", e.target.value)}
            />
          </Field>
        </section>
        <div hidden={step !== 1}>
          <h2 id="setup-step-title-1" tabIndex={-1}>
            When and where
          </h2>
          {data.functions.map((f: any, i: number) => (
            <section className="card" key={f.id ?? i}>
              <div className="page-head">
                <h2>{i === 0 ? "Main celebration" : `Function ${i + 1}`}</h2>
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    patch("functions", [
                      ...data.functions,
                      { ...f, id: undefined, name: f.name + " (copy)" },
                    ])
                  }
                >
                  Duplicate function
                </button>
                {data.functions.length > 1 && (
                  <button
                    type="button"
                    className="text-button danger"
                    onClick={() =>
                      patch(
                        "functions",
                        data.functions.filter((_: any, n: number) => n !== i),
                      )
                    }
                  >
                    Remove function
                  </button>
                )}
              </div>
              {i > 0 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    for (const key of ["venue", "address", "mapUrl"])
                      update(i, key, data.functions[0][key]);
                  }}
                >
                  Same venue as main event
                </button>
              )}
              <div className="grid two">
                <Field label="Function name">
                  <input
                    required={step === 1}
                    value={f.name}
                    onChange={(e) => update(i, "name", e.target.value)}
                    list="functions"
                  />
                </Field>
                <Field label={`Date & time (${data.timezone})`}>
                  <input
                    required={step === 1}
                    type="datetime-local"
                    value={f.startsAt}
                    onChange={(e) => update(i, "startsAt", e.target.value)}
                  />
                </Field>
                <Field label="Venue name">
                  <input
                    required={step === 1}
                    value={f.venue}
                    maxLength={200}
                    onChange={(e) => update(i, "venue", e.target.value)}
                  />
                </Field>
                <Field label="Venue address">
                  <input
                    value={f.address}
                    maxLength={1000}
                    onChange={(e) => update(i, "address", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Map link (optional, http/https)">
                <input
                  type="url"
                  value={f.mapUrl}
                  onChange={(e) => update(i, "mapUrl", e.target.value)}
                />
              </Field>
              <label className="check">
                <input
                  type="checkbox"
                  checked={f.themeEnabled}
                  onChange={(e) => update(i, "themeEnabled", e.target.checked)}
                />
                Add a theme or dress code
              </label>
              {f.themeEnabled && (
                <div className="inset">
                  <p>
                    Outfit guidance · This does not change the invitation
                    design.
                  </p>
                  <div className="actions">
                    {[
                      "Traditional",
                      "Pastels",
                      "Black & White",
                      "Bollywood",
                      "Formal",
                      "Casual",
                    ].map((t) => (
                      <button
                        type="button"
                        className="secondary"
                        key={t}
                        onClick={() => {
                          update(i, "theme", t);
                          update(
                            i,
                            "outfit",
                            t === "Traditional"
                              ? "Celebrate in your favourite Indian attire."
                              : `Wear your favourite ${t.toLowerCase()} outfit.`,
                          );
                          update(
                            i,
                            "colours",
                            t === "Pastels"
                              ? "Peach, lilac, mint"
                              : t === "Black & White"
                                ? "Black, white"
                                : "",
                          );
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="grid two">
                    <Field label="Theme name">
                      <input
                        value={f.theme}
                        onChange={(e) => update(i, "theme", e.target.value)}
                        placeholder="Pastel Garden"
                      />
                    </Field>
                    <Field label="Guidance">
                      <select
                        value={f.guidance}
                        onChange={(e) => update(i, "guidance", e.target.value)}
                      >
                        <option>Suggested</option>
                        <option>Requested</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Outfit instructions">
                    <textarea
                      value={f.outfit}
                      onChange={(e) => update(i, "outfit", e.target.value)}
                      placeholder="Wear pastel Indian or Western outfits. Floral prints are welcome."
                    />
                  </Field>
                  <Field label="Suggested colours (optional)">
                    <input
                      value={f.colours}
                      onChange={(e) => update(i, "colours", e.target.value)}
                      placeholder="Peach, mint green and cream"
                    />
                  </Field>
                </div>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={f.catering}
                  onChange={(e) => update(i, "catering", e.target.checked)}
                />
                Add catering estimates
              </label>
              {f.catering && (
                <div className="inset">
                  <p>
                    Add your per-person prices and any fixed catering charges.
                  </p>
                  <div className="grid three">
                    <Field label="Currency">
                      <input
                        value={f.currency}
                        maxLength={3}
                        required={step === 1}
                        onChange={(e) =>
                          update(i, "currency", e.target.value.toUpperCase())
                        }
                      />
                    </Field>
                    {[
                      ["adultRate", "Adult price per plate"],
                      ["childRate", "Child price (blank = adult rate)"],
                      ["fixed", "Fixed charges"],
                      ["budget", "Budget (optional)"],
                    ].map(([key, label]) => (
                      <Field label={label} key={key}>
                        <input
                          type="number"
                          min="0"
                          max="10000000"
                          step="0.01"
                          required={
                            step === 1 &&
                            (key === "adultRate" || key === "fixed")
                          }
                          value={f[key] === null ? "" : f[key] / 100}
                          onChange={(e) =>
                            update(
                              i,
                              key,
                              e.target.value === ""
                                ? null
                                : Math.round(Number(e.target.value) * 100),
                            )
                          }
                        />
                      </Field>
                    ))}
                    <Field label="Buffer percentage (0–100)">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        required={step === 1}
                        value={f.buffer}
                        onChange={(e) =>
                          update(i, "buffer", Number(e.target.value))
                        }
                      />
                    </Field>
                  </div>
                </div>
              )}
            </section>
          ))}
          <datalist id="functions">
            {["Haldi", "Mehndi", "Sangeet", "Wedding", "Reception"].map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <button
            className="secondary"
            type="button"
            onClick={() =>
              patch("functions", [...data.functions, blankFunction()])
            }
          >
            + Add another function
          </button>
          {data.type === "Wedding" && (
            <div className="actions preset-actions">
              {["Haldi", "Mehndi", "Sangeet", "Wedding", "Reception"].map(
                (name) => (
                  <button
                    key={name}
                    type="button"
                    className="secondary"
                    onClick={() =>
                      patch("functions", [
                        ...data.functions,
                        { ...blankFunction(), name },
                      ])
                    }
                  >
                    + {name}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
        <section className="card" hidden={step !== 2}>
          <h2 id="setup-step-title-2" tabIndex={-1}>
            Preview and publish
          </h2>
          <p className="eyebrow">Your invitation preview</p>
          <div className="setup-preview">
            <h2>{data.title || "Your celebration"}</h2>
            <p>{data.names}</p>
            <p>{data.welcome}</p>
            {data.functions.map((f: any, i: number) => (
              <p key={i}>
                <strong>{f.name}</strong> · {f.startsAt.replace("T", " at ")}
                <br />
                {f.venue}
              </p>
            ))}
          </div>
          <details>
            <summary>Optional planning settings</summary>
            <div className="grid three">
              <Field label="Timezone (IANA name)">
                <input
                  required={step === 2}
                  value={data.timezone}
                  onChange={(e) => patch("timezone", e.target.value)}
                />
              </Field>
              <Field label="Expected guest count — planning target">
                <input
                  type="number"
                  min="0"
                  max="100000"
                  required={step === 2}
                  value={data.expected}
                  onChange={(e) => patch("expected", Number(e.target.value))}
                />
              </Field>
              <Field label="Reply by (optional, in event timezone)">
                <input
                  type="datetime-local"
                  value={data.deadline}
                  onChange={(e) => patch("deadline", e.target.value)}
                />
              </Field>
            </div>
          </details>
          <label className="check">
            <input
              type="checkbox"
              checked={data.notify}
              onChange={(e) => patch("notify", e.target.checked)}
            />
            Notify me about new responses and changes
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={data.published}
              onChange={(e) => patch("published", e.target.checked)}
            />
            Publish invitation (free in local testing)
          </label>
          <p>
            Unpublished invitations cannot receive guest responses. Hosts can
            still edit responses after a deadline.
          </p>
          <button disabled={busy} type="submit">
            {busy
              ? "Saving…"
              : data.published
                ? "Save & publish"
                : "Save draft"}
          </button>
        </section>
        <div className="actions wizard-controls">
          {step > 0 && (
            <button
              type="button"
              className="secondary"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          {step < 2 && <button type="submit">Continue</button>}
        </div>
      </form>
    </>
  );
}
