"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Copy, ErrorBox, Field, money, when, Theme, Icon } from "./common";
import ResponseForm from "./ResponseForm";
export default function Dashboard({ id }: { id: string }) {
  const router = useRouter();
  const replacementDialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState("Overview");
  const [message, setMessage] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<any>(null);
  const [rotationBusy, setRotationBusy] = useState(false);
  useEffect(() => {
    if (replacing) replacementDialog.current?.showModal();
  }, [replacing]);
  const [event, setEvent] = useState<any>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [functionId, setFunctionId] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<any>(undefined);
  const [adding, setAdding] = useState(false);
  const [invite, setInvite] = useState(false);
  const [privateLink, setPrivateLink] = useState("");
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [updated, setUpdated] = useState("");
  const load = () =>
    api("events/" + id)
      .then((data) => {
        setEvent(data);
        setError("");
        setUpdated(new Date().toLocaleTimeString());
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [id]);
  if (!event)
    return (
      <>
        <ErrorBox error={error} />
        {!error && (
          <div
            role="status"
            aria-label="Loading dashboard"
            className="skeleton"
          />
        )}
      </>
    );
  const link = window.location.origin + "/invite/" + id;
  const shareMessage =
    message ??
    `${event.title}\n${event.functions[0] ? when(event.functions[0].startsAt, event.timezone) : ""}\nWe’d love to celebrate with you! Please join us and let us know if you’re coming.\n${link}`;
  const rows = event.households.filter((h: any) => {
    const match =
      !search ||
      (
        h.name +
        " " +
        h.contact +
        " " +
        h.members.map((m: any) => m.name).join(" ")
      )
        .toLowerCase()
        .includes(search.toLowerCase());
    const allowed =
      !functionId ||
      !h.invited ||
      h.functions.some((f: any) => f.functionId === functionId);
    const attendance = h.attendance.filter(
      (a: any) => !a.memberId && (!functionId || a.functionId === functionId),
    );
    return (
      match &&
      allowed &&
      (!status ||
        (status === "Pending"
          ? !h.responded && h.invited
          : attendance.some((a: any) => a.status === status)))
    );
  });
  const histories = event.households
    .flatMap((h: any) => h.history.map((c: any) => ({ ...c, name: h.name })))
    .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 15);
  return (
    <>
      <Link href="/host">← All events</Link>
      <div className="page-head">
        <div>
          <p className="eyebrow">
            {event.type}{" "}
            <span className={"badge " + (event.published ? "live" : "")}>
              {event.published ? "Published" : "Draft"}
            </span>
          </p>
          <h1>{event.title}</h1>
          <p>{event.names}</p>
        </div>
        <div className="actions">
          {event.published && (
            <button onClick={() => setTab("Invitation")}>
              Share invitation
            </button>
          )}
          <Link className="button" href={"/host/events/" + id + "/edit"}>
            {event.published ? "Edit event" : "Finish setup"}
          </Link>
        </div>
      </div>
      <ErrorBox error={error} />
      <nav className="dashboard-nav" aria-label="Event sections">
        {["Overview", "Guests", "Invitation", "Budget", "Settings"].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            <Icon name={t} />
            {t}
          </button>
        ))}
      </nav>
      <div hidden={tab !== "Overview"}>
        {!event.published && (
          <section className="card">
            <p className="eyebrow">A beautiful celebration is taking shape</p>
            <h2>Let’s finish the details.</h2>
            <ul>
              <li>Occasion: {event.title ? "Ready" : "Add a title"}</li>
              <li>
                Schedule: {event.functions.length}{" "}
                {event.functions.length === 1 ? "function" : "functions"}
              </li>
              <li>Invitation: waiting to be published</li>
            </ul>
            <Link className="button" href={"/host/events/" + id + "/edit"}>
              Finish setup
            </Link>
          </section>
        )}
        <p className="muted">
          <button className="text-button" onClick={load}>
            Refresh
          </button>{" "}
          · Auto-refresh every 15 seconds · Last updated {updated}
        </p>
        <section className="grid four metrics">
          {[
            [
              "Confirmed people",
              new Set(
                event.households.flatMap((h: any) =>
                  h.attendance
                    .filter((a: any) => a.memberId && a.status === "Attending")
                    .map((a: any) => a.memberId),
                ),
              ).size,
              "people · across your celebration",
            ],
            [
              "Awaiting reply",
              event.metrics.pendingHouseholds,
              "invited households",
            ],
            [
              "Unable to attend",
              event.households.filter(
                (h: any) =>
                  h.responded &&
                  h.attendance.filter((a: any) => !a.memberId).length &&
                  h.attendance
                    .filter((a: any) => !a.memberId)
                    .every((a: any) => a.status === "Unable to attend"),
              ).length,
              "households · all functions",
            ],
            [
              "Guest target",
              event.expected || "Not set",
              "people · planning only",
            ],
          ].map(([label, note, unit]) => (
            <article className="card" key={String(label)}>
              <small>{label}</small>
              <strong>{note}</strong>
              <small>{unit}</small>
            </article>
          ))}
        </section>
      </div>
      <div hidden={tab !== "Invitation"}>
        <section className="card">
          <h2>Share your invitation</h2>
          {event.published ? (
            <>
              <div className="link-row">
                <input
                  aria-label="General invitation link"
                  readOnly
                  value={link}
                />
                <Copy value={link} />
                <a
                  className="button secondary"
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Preview invitation ↗
                </a>
                <a
                  className="button secondary"
                  target="_blank"
                  rel="noreferrer"
                  href={
                    "https://wa.me/?text=" + encodeURIComponent(shareMessage)
                  }
                >
                  Share on WhatsApp
                </a>
              </div>
              <p>General link: guests create a new household response.</p>
              <Field label="Your invitation message · edit before sharing">
                <textarea
                  className="share-message"
                  value={shareMessage}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </Field>
              <Copy value={shareMessage} label="Copy invitation message" />
            </>
          ) : (
            <p>
              Save and publish the event in the editor to enable guest
              responses.
            </p>
          )}
          <small>
            A localhost link works in another browser on this computer. A phone
            needs local-network access configured or a hosted website.
          </small>
        </section>
      </div>
      <div hidden={tab !== "Overview" && tab !== "Budget"}>
        <h2>
          {tab === "Budget"
            ? "Catering & budget"
            : "Your celebration, by function"}
        </h2>
        <div className="grid two">
          {event.functions.map((f: any) => {
            const t = event.totals.find((t: any) => t.functionId === f.id);
            return (
              <article className="card" key={f.id}>
                <h3>{f.name}</h3>
                <p>
                  {when(f.startsAt, event.timezone)} · {event.timezone}
                  <br />
                  {f.venue} · {f.address}
                </p>
                <Theme f={f} />
                <div className="count">
                  <strong>{t.total}</strong> confirmed people
                </div>
                <p>
                  {t.adults} adults · {t.children} children
                </p>
                <p>
                  {t.declined} declined households · {t.unsure} unsure
                  households
                </p>
                {f.catering ? (
                  <div className="inset">
                    <p>
                      Confirmed catering estimate:{" "}
                      <strong>{money(t.confirmed, f.currency)}</strong>
                    </p>
                    <p>
                      Buffered planning: {t.planningTotal} people (
                      {t.planningAdults} adults + {t.planningChildren}{" "}
                      children), {f.buffer}% buffer
                    </p>
                    <p>
                      Buffered planning estimate:{" "}
                      <strong>{money(t.buffered, f.currency)}</strong>
                    </p>
                    <p>
                      Budget:{" "}
                      {f.budget === null
                        ? "Not set"
                        : money(f.budget, f.currency)}
                    </p>
                    {t.variance !== null && (
                      <p>
                        {money(Math.abs(t.variance), f.currency)}{" "}
                        {t.variance >= 0 ? "below" : "above"} budget (buffered
                        estimate)
                      </p>
                    )}
                    {t.childRateAssumed && (
                      <small>
                        Child rate is blank; the adult price is used.
                      </small>
                    )}
                    <p>
                      <small>
                        Estimates only. Additional adult and child counts round
                        up separately. Fixed charges are included once.
                      </small>
                    </p>
                  </div>
                ) : (
                  <p className="muted">
                    Catering estimates are off for this function.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </div>
      <div hidden={tab !== "Guests"}>
        <section className="card">
          <div className="page-head">
            <h2>Households & guests</h2>
            <div className="actions">
              <button className="secondary" onClick={() => setInvite(!invite)}>
                Add household invitation
              </button>
              <button
                onClick={() => {
                  setAdding(true);
                  setSelected(null);
                }}
              >
                Add response manually
              </button>
            </div>
          </div>
          {invite && (
            <InviteForm
              event={event}
              onSaved={(t: string) => {
                setPrivateLink(window.location.origin + "/response/" + t);
                setInvite(false);
                load();
              }}
            />
          )}
          {privateLink && (
            <div className="notice">
              <h3>Private household link ready</h3>
              <p>
                Copy and keep this link now. Only a secure hash is stored; the
                link cannot be retrieved later. You can replace it if needed.
              </p>
              <input
                aria-label="Private household link"
                readOnly
                value={privateLink}
              />
              <Copy value={privateLink} />
              <a
                className="button secondary"
                href={privateLink}
                target="_blank"
                rel="noreferrer"
              >
                Open private invitation ↗
              </a>
              <a
                className="button secondary"
                target="_blank"
                rel="noreferrer"
                href={
                  "https://wa.me/?text=" +
                  encodeURIComponent(
                    event.title +
                      "\nYou’re invited! Please reply for your family.\n" +
                      privateLink,
                  )
                }
              >
                Share private link on WhatsApp
              </a>
              <p>
                Anyone possessing this link can manage this household’s
                response.
              </p>
            </div>
          )}
          <div className="grid three filters">
            <Field label="Search household or member">
              <input
                value={search}
                placeholder="Search names…"
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            <Field label="Function">
              <select
                value={functionId}
                onChange={(e) => setFunctionId(e.target.value)}
              >
                <option value="">All functions</option>
                {event.functions.map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Attendance">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All attendance</option>
                {["Attending", "Unable to attend", "Unsure", "Pending"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </Field>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Household / contact</th>
                  <th>Members</th>
                  <th>Function attendance</th>
                  <th>Source / updated</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h: any) => (
                  <tr key={h.id}>
                    <td>
                      <strong>{h.name}</strong>
                      <br />
                      {h.contact}
                      <br />
                      <small>
                        {h.invited
                          ? `Invited: up to ${h.maxPeople} people`
                          : "General link / manual response"}
                      </small>
                    </td>
                    <td>
                      {h.members.length
                        ? h.members.map((m: any) => (
                            <div key={m.id}>
                              {m.name} · {m.category}
                              {m.diet ? " · " + m.diet : ""}
                            </div>
                          ))
                        : "—"}
                    </td>
                    <td>
                      {event.functions
                        .filter(
                          (f: any) =>
                            (!functionId || f.id === functionId) &&
                            (!h.invited ||
                              h.functions.some(
                                (i: any) => i.functionId === f.id,
                              )),
                        )
                        .map((f: any) => (
                          <div key={f.id}>
                            {f.name}:{" "}
                            {h.attendance.find(
                              (a: any) => a.functionId === f.id && !a.memberId,
                            )?.status ?? "Pending"}{" "}
                            (
                            {
                              h.attendance.filter(
                                (a: any) => a.functionId === f.id && a.memberId,
                              ).length
                            }{" "}
                            people)
                          </div>
                        ))}
                    </td>
                    <td>
                      {h.source}
                      <br />
                      <small>{new Date(h.updatedAt).toLocaleString()}</small>
                    </td>
                    <td>
                      <button
                        className="secondary"
                        onClick={() => {
                          setSelected(h);
                          setAdding(false);
                        }}
                      >
                        View / edit
                      </button>
                      <button
                        className="text-button"
                        onClick={() => setReplacing(h)}
                      >
                        Replace private link
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <p className="empty">
                No households match. Add an invitation or share your general
                link.
              </p>
            )}
          </div>
          <div className="actions exports">
            <a
              className="button secondary"
              href={"/api/events/" + id + "/export?format=csv"}
            >
              Download guest CSV
            </a>
            <a
              className="button secondary"
              href={"/api/events/" + id + "/export?format=xlsx"}
            >
              Download Excel workbook
            </a>
          </div>
          <small>Downloads are snapshots. They do not continue updating.</small>
        </section>
        {(adding || selected) && (
          <section className="card">
            <div className="page-head">
              <h2>{selected ? "Household details" : "Manual response"}</h2>
              <button
                className="text-button"
                onClick={() => {
                  setSelected(undefined);
                  setAdding(false);
                }}
              >
                Close editor
              </button>
            </div>
            {selected && (
              <p>
                {selected.email} · {selected.phone}
                <br />
                {selected.notes}
              </p>
            )}
            <ResponseForm
              key={selected?.id ?? "new"}
              event={{
                ...event,
                functions: event.functions.filter(
                  (f: any) =>
                    !selected?.invited ||
                    selected.functions.some((i: any) => i.functionId === f.id),
                ),
              }}
              household={selected}
              endpoint={
                "events/" +
                id +
                (selected ? "/households/" + selected.id : "/respond")
              }
              method={selected ? "PUT" : "POST"}
              host
              onSaved={() => {
                setSelected(undefined);
                setAdding(false);
                load();
              }}
            />
          </section>
        )}
        <section className="card">
          <h2>Recent response changes</h2>
          {!histories.length ? (
            <p>No responses yet.</p>
          ) : (
            histories.map((h: any) => (
              <details key={h.id}>
                <summary>
                  {h.name} · {h.source} ·{" "}
                  {new Date(h.createdAt).toLocaleString()}
                </summary>
                <div className="grid two">
                  <div>
                    <strong>Before</strong>
                    <History value={h.before} />
                  </div>
                  <div>
                    <strong>After</strong>
                    <History value={h.after} />
                  </div>
                </div>
              </details>
            ))
          )}
        </section>
      </div>
      <div hidden={tab !== "Settings"}>
        <section className="card">
          <h2>Invitation availability</h2>
          <p>
            {event.published
              ? "Your invitation is open for guest responses."
              : "Your invitation is a draft."}
          </p>
          <Link
            className="button secondary"
            href={"/host/events/" + id + "/edit"}
          >
            Edit invitation & publishing
          </Link>
          {event.published && (
            <button
              className="secondary"
              onClick={async () => {
                if (
                  !window.confirm(
                    "Unpublish this invitation? Guest links will stop working until you publish again. Saved responses stay intact.",
                  )
                )
                  return;
                try {
                  await api("events/" + id + "/publication", "POST", {
                    published: false,
                    version: event.version,
                  });
                  load();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Unpublish invitation
            </button>
          )}
        </section>
        <section className="card">
          <button
            className="text-button danger"
            onClick={() => setDeleting(!deleting)}
          >
            Delete event…
          </button>
          {deleting && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api("events/" + id, "DELETE", { confirm });
                  router.push("/host");
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            >
              <p>
                This permanently deletes the event, households and responses.
                Type “{event.title}” to confirm.
              </p>
              <Field label="Event title to confirm deletion">
                <input
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>
              <button
                className="danger-button"
                disabled={confirm !== event.title}
              >
                Permanently delete event
              </button>
            </form>
          )}
        </section>
      </div>
      {replacing && (
        <dialog
          ref={replacementDialog}
          onCancel={() => setReplacing(null)}
          aria-labelledby="replace-title"
          className="card modal"
        >
          <h2 id="replace-title">Replace private link?</h2>
          <p>
            The previous private link for <strong>{replacing.name}</strong> will
            stop working. Their household and saved responses will be preserved.
          </p>
          <div className="actions">
            <button
              autoFocus
              className="secondary"
              disabled={rotationBusy}
              onClick={() => setReplacing(null)}
            >
              Cancel
            </button>
            <button
              disabled={rotationBusy}
              onClick={async () => {
                setRotationBusy(true);
                try {
                  const r = await api(
                    "events/" +
                      id +
                      "/households/" +
                      replacing.id +
                      "/replace-link",
                    "POST",
                  );
                  setPrivateLink(
                    window.location.origin + "/response/" + r.token,
                  );
                  setReplacing(null);
                  setTab("Guests");
                } catch (e) {
                  setError((e as Error).message);
                  setReplacing(null);
                } finally {
                  setRotationBusy(false);
                }
              }}
            >
              {rotationBusy ? "Replacing…" : "Replace private link"}
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
function History({ value }: { value: string }) {
  const d = JSON.parse(value);
  return d.name ? (
    <>
      <p>
        {d.name} · {d.contact}
      </p>
      <p>{d.statuses.map((s: any) => s.status).join(" / ")}</p>
      <p>
        {d.members
          .map((m: any) => m.name + " (" + m.category + ")")
          .join(", ") || "No attending members"}
      </p>
      <p>{d.notes}</p>
    </>
  ) : (
    <p>No previous response</p>
  );
}
function InviteForm({
  event,
  onSaved,
}: {
  event: any;
  onSaved: (token: string) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="inset"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          const result = await api(
            "events/" + event.id + "/households",
            "POST",
            {
              name: f.get("name"),
              email: f.get("email"),
              phone: f.get("phone"),
              maxPeople: Number(f.get("maxPeople")),
              functionIds: f.getAll("functionIds"),
            },
          );
          onSaved(result.token);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Private household invitation</h3>
      <ErrorBox error={error} />
      <div className="grid two">
        <Field label="Household / family name">
          <input name="name" required maxLength={200} />
        </Field>
        <Field label="Maximum invited people">
          <input
            name="maxPeople"
            type="number"
            min="1"
            max="1000"
            defaultValue="4"
            required
          />
        </Field>
        <Field label="Contact email (optional)">
          <input name="email" type="email" />
        </Field>
        <Field label="Contact phone (optional)">
          <input name="phone" type="tel" maxLength={50} />
        </Field>
      </div>
      <p>Invited functions (choose at least one):</p>
      {event.functions.map((f: any) => (
        <label className="check" key={f.id}>
          <input
            type="checkbox"
            name="functionIds"
            value={f.id}
            defaultChecked
          />
          {f.name}
        </label>
      ))}
      <button disabled={busy}>
        {busy ? "Creating…" : "Create private invitation"}
      </button>
    </form>
  );
}
