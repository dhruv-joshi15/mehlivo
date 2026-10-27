"use client";
import { useEffect, useState } from "react";
import { api, Copy, ErrorBox, Theme, when } from "./common";
import ResponseForm from "./ResponseForm";
export default function Invitation({
  token,
  privateLink,
}: {
  token: string;
  privateLink: boolean;
}) {
  const [event, setEvent] = useState<any>(null);
  const [household, setHousehold] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [thanks, setThanks] = useState(false);
  const [savedLink, setSavedLink] = useState("");
  const load = () =>
    api((privateLink ? "response/" : "public/") + token)
      .then((data) => {
        setEvent(privateLink ? data.event : data);
        setHousehold(privateLink ? data.household : null);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    setEvent(null);
    setError("");
    setEditing(false);
    setThanks(new URLSearchParams(window.location.search).has("saved"));
    load();
    if (!privateLink) {
      try {
        setSavedLink(localStorage.getItem("mehlivo-response:" + token) ?? "");
      } catch {}
    }
  }, [token, privateLink]);
  if (!event)
    return (
      <>
        <ErrorBox error={error} />
        {!error && (
          <div
            role="status"
            aria-label="Loading invitation"
            className="skeleton"
          />
        )}
      </>
    );
  const closed = event.deadline && new Date(event.deadline) < new Date();
  return (
    <div className="invitation">
      <section className="card invitation-head">
        <p className="eyebrow">You’re invited · {event.type}</p>
        <h1>{event.title}</h1>
        <h2>{event.names}</h2>
        {household && <p>For {household.name}</p>}
        <p className="prewrap">{event.welcome}</p>
        {event.functions[0] && (
          <p>
            <strong>{when(event.functions[0].startsAt, event.timezone)}</strong>
            <br />
            {event.functions[0].venue}
          </p>
        )}
        {event.deadline && (
          <p className="muted">
            Please respond by {when(event.deadline, event.timezone)} (
            {event.timezone})
          </p>
        )}
        <a className="button" href="#rsvp">
          {household?.responded ? "View my response" : "Let us know you’re coming"}
        </a>
      </section>
      <section>
        <h2>The schedule</h2>
        {event.functions.map((f: any) => (
          <article className="card" key={f.id}>
            <h3>{f.name}</h3>
            <p>
              {when(f.startsAt, event.timezone)} · {event.timezone}
            </p>
            <p>
              <strong>{f.venue}</strong>
              <br />
              {f.address}
            </p>
            {f.mapUrl && (
              <a href={f.mapUrl} rel="noreferrer" target="_blank">
                Open map ↗
              </a>
            )}
            <Theme f={f} />
          </article>
        ))}
      </section>
      <section id="rsvp">
        {thanks && (
          <div className="celebration">
            <button
              type="button"
              className="text-button"
              onClick={() => setThanks(false)}
              aria-label="Dismiss celebration"
            >
              Dismiss
            </button>
            <h2>A little reply. A lot of joy.</h2>
            <p>
              Your host has your response. Thank you for being part of the
              celebration.
            </p>
          </div>
        )}
        <ErrorBox error={error} />
        {thanks && (
          <p role="status" className="success">
            Thank you, {household?.name || "family"}! Your response has been
            saved.
          </p>
        )}
        {savedLink && !privateLink && (
          <div className="notice">
            <p>A response link is remembered in this browser.</p>
            <a href={savedLink}>View my response</a>
          </div>
        )}
        {household?.responded && !editing ? (
          <section className="card">
            <h2>Your saved response</h2>
            <p>
              <strong>{household.name}</strong> · {household.contact}
            </p>
            {event.functions.map((f: any) => (
              <div className="inset" key={f.id}>
                <h3>{f.name}</h3>
                <p>
                  {household.attendance.find(
                    (a: any) => a.functionId === f.id && !a.memberId,
                  )?.status ?? "Pending"}
                </p>
                <p>
                  Total attending, including you:{" "}
                  {
                    household.attendance.filter(
                      (a: any) =>
                        a.functionId === f.id &&
                        a.memberId &&
                        a.status === "Attending",
                    ).length
                  }
                </p>
                <p>
                  Members attending:{" "}
                  {household.members
                    .filter((m: any) =>
                      household.attendance.some(
                        (a: any) =>
                          a.memberId === m.id &&
                          a.functionId === f.id &&
                          a.status === "Attending",
                      ),
                    )
                    .map((m: any) => m.name)
                    .join(", ") || "None confirmed"}
                </p>
                <Theme f={f} />
              </div>
            ))}
            {household.members.map((m: any) => (
              <p key={m.id}>
                {m.name} · {m.category}
                {m.diet ? " · " + m.diet : ""}
              </p>
            ))}
            {household.notes && <p>Notes: {household.notes}</p>}
            {!closed && (
              <button onClick={() => setEditing(true)}>
                Update my response
              </button>
            )}
            <div className="notice">
              <p>
                Keep this private link. Anyone who possesses it can view and
                manage this household’s response.
              </p>
              <Copy
                value={
                  typeof window !== "undefined" ? window.location.href : ""
                }
                label="Copy private response link"
              />
            </div>
          </section>
        ) : !closed ? (
          <ResponseForm
            key={household?.version ?? "new"}
            event={event}
            household={household}
            endpoint={
              (privateLink ? "response/" : "public/") +
              token +
              (privateLink ? "" : "/respond")
            }
            onSaved={async (result) => {
              if (result.managementToken) {
                const link =
                  window.location.origin +
                  "/response/" +
                  result.managementToken;
                try {
                  localStorage.setItem("mehlivo-response:" + event.id, link);
                } catch {}
                window.location.assign(link + "?saved=1");
              } else {
                await load();
                setEditing(false);
                setThanks(true);
              }
            }}
          />
        ) : null}
        {typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).has("saved") &&
          !thanks &&
          household?.responded && (
            <p className="success">
              Thank you, {household.name}! Your response has been saved.
            </p>
          )}
        {closed && (
          <p className="notice">
            The reply deadline has passed. Contact the host for changes.
          </p>
        )}
      </section>
    </div>
  );
}
