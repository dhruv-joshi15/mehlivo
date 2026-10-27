"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createAuthClient } from "better-auth/react";
import { api, Field, ErrorBox } from "./common";
import EventEditor from "./EventEditor";
import Dashboard from "./Dashboard";
import Invitation from "./Invitation";
import { Landing, Demo } from "./Landing";
const authClient = createAuthClient();
export default function App() {
  return (
    <Suspense fallback={<p>Loading Mehlivo…</p>}>
      <Shell />
    </Suspense>
  );
}
function Shell() {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [checkedPath, setCheckedPath] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    api("me")
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setCheckedPath(path));
  }, [path]);
  const isPublic = path.startsWith("/invite/") || path.startsWith("/response/");
  useEffect(() => {
    if (checkedPath === path && !me && path.startsWith("/host"))
      router.replace("/login");
  }, [checkedPath, me, path, router]);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header>
        <Link href="/" className="brand">
          mehlivo<span>Invitations, together.</span>
        </Link>
        <nav>
          {me ? (
            <>
              <Link href="/host">My events</Link>
              <Link href="/host/events/new">Create event</Link>
              {me.local && (
                <details className="account-menu">
                  <summary>Account</summary>
                  <Link href="/host/inbox">Development inbox</Link>
                </details>
              )}
              <button
                className="text-button"
                onClick={async () => {
                  await authClient.signOut();
                  setMe(null);
                  router.push("/login");
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link href="/signup">Create account</Link>
            </>
          )}
        </nav>
      </header>
      <main id="main-content">
        <ErrorBox error={error} />
        {path === "/demo" ? (
          <Demo />
        ) : isPublic ? (
          <Invitation
            token={path.split("/")[2]}
            privateLink={path.startsWith("/response/")}
          />
        ) : path === "/login" ||
          path === "/signup" ||
          path === "/forgot-password" ||
          path === "/reset-password" ? (
          <AuthForm kind={path.slice(1)} />
        ) : path.startsWith("/host") ? (
          checkedPath !== path || !me ? (
            <p role="status">Loading your account…</p>
          ) : path === "/host/inbox" ? (
            <Inbox />
          ) : path === "/host/events/new" ? (
            <EventEditor />
          ) : path.endsWith("/edit") ? (
            <EventEditor id={path.split("/")[3]} />
          ) : path.startsWith("/host/events/") ? (
            <Dashboard id={path.split("/")[3]} />
          ) : (
            <Events name={me.user.name} />
          )
        ) : (
          <Landing signedIn={!!me} />
        )}
      </main>
      <footer>Mehlivo · Made for the moments you share.</footer>
    </>
  );
}
function AuthForm({ kind }: { kind: string }) {
  const router = useRouter();
  const query = useSearchParams();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = kind === "signup",
    forgot = kind === "forgot-password",
    reset = kind === "reset-password";
  return (
    <section className="card auth">
      <p className="eyebrow">Your host account</p>
      <h1>
        {signup
          ? "Welcome to Mehlivo"
          : forgot
            ? "Reset your password"
            : reset
              ? "Choose a new password"
              : "Welcome back"}
      </h1>
      <ErrorBox error={error} />
      {success && (
        <p role="status" className="success">
          {success}
        </p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          const data = new FormData(e.currentTarget);
          try {
            let result;
            if (signup)
              result = await authClient.signUp.email({
                name: String(data.get("name")),
                email: String(data.get("email")),
                password: String(data.get("password")),
                callbackURL: "/host",
              });
            else if (forgot)
              result = await authClient.requestPasswordReset({
                email: String(data.get("email")),
                redirectTo: window.location.origin + "/reset-password",
              });
            else if (reset)
              result = await authClient.resetPassword({
                newPassword: String(data.get("password")),
                token: query.get("token") ?? "",
              });
            else
              result = await authClient.signIn.email({
                email: String(data.get("email")),
                password: String(data.get("password")),
              });
            if (result.error) throw new Error(result.error.message);
            if (forgot)
              setSuccess(
                process.env.NODE_ENV !== "production"
                  ? "If that account exists, a reset message is available in the local development inbox. You can also run npm run inbox locally if you cannot sign in."
                  : "If that account exists, password reset instructions have been requested.",
              );
            else if (reset) setSuccess("Password updated. You can now log in.");
            else router.push("/host");
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {signup && (
          <Field label="Your name">
            <input name="name" required autoComplete="name" maxLength={200} />
          </Field>
        )}
        {!reset && (
          <Field label="Email">
            <input name="email" type="email" required autoComplete="email" />
          </Field>
        )}
        {!forgot && (
          <Field label="Password (at least 10 characters)">
            <input
              name="password"
              type="password"
              minLength={10}
              required
              autoComplete={
                signup || reset ? "new-password" : "current-password"
              }
            />
          </Field>
        )}
        <button disabled={busy}>
          {busy
            ? "Please wait…"
            : signup
              ? "Create account"
              : forgot
                ? "Create reset message"
                : reset
                  ? "Save new password"
                  : "Log in"}
        </button>
      </form>
      <div className="auth-links">
        <Link href="/login">Log in</Link>
        <Link href="/signup">Sign up</Link>
        <Link href="/forgot-password">Forgot password?</Link>
      </div>
      {process.env.NODE_ENV !== "production" && (
        <small>
          Local email testing: messages are stored for preview, never delivered.
        </small>
      )}
    </section>
  );
}
function Events({ name }: { name: string }) {
  const [events, setEvents] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("events")
      .then(setEvents)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Your celebrations</p>
          <h1>Hello, {name}.</h1>
          <p>Keep your invitations and attendance in one place.</p>
        </div>
        <Link className="button" href="/host/events/new">
          Create event
        </Link>
      </div>
      <ErrorBox error={error} />
      {!events ? (
        <div role="status" aria-label="Loading events" className="skeleton" />
      ) : events.length ? (
        <div className="grid two">
          {events.map((e) => (
            <Link
              className="card event-card"
              href={"/host/events/" + e.id + (e.published ? "" : "/edit")}
              key={e.id}
            >
              <span className={"badge " + (e.published ? "live" : "")}>
                {e.published ? "Published" : "Draft"}
              </span>
              <p className="eyebrow">{e.type}</p>
              <h2>{e.title}</h2>
              <p>{e.names}</p>
              <p>
                {e.functions[0]?.startsAt
                  ? new Date(e.functions[0].startsAt).toLocaleDateString(
                      "en-IN",
                      { dateStyle: "long", timeZone: e.timezone },
                    )
                  : "Date to be decided"}
              </p>
              <small>
                {e.functions.length}{" "}
                {e.functions.length === 1 ? "function" : "functions"} ·{" "}
                {e._count.households}{" "}
                {e._count.households === 1 ? "household" : "households"}
              </small>
              {e.published && (
                <p>
                  {e.confirmedPeople} confirmed{" "}
                  {e.confirmedPeople === 1 ? "person" : "people"}
                </p>
              )}
              <p className="event-action">
                {e.published ? "Open dashboard" : "Continue setup"}{" "}
                <span aria-hidden="true">↗</span>
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card empty">
          <h2>Create your first event</h2>
          <p>
            Start with a date, a venue and the people you want to celebrate
            with.
          </p>
          <Link className="button" href="/host/events/new">
            Create your first event
          </Link>
        </div>
      )}
    </>
  );
}
function Inbox() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState("");
  const load = () =>
    api("inbox")
      .then(setItems)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Development inbox</h1>
          <p>
            Development preview — not delivered. Only messages for your account
            appear here.
          </p>
        </div>
        <button onClick={load}>Refresh / retry pending</button>
      </div>
      <ErrorBox error={error} />
      {!items.length && <p className="card">No messages yet.</p>}
      {items.map((m) => (
        <article className="card mail" key={m.id}>
          <small>
            {new Date(m.createdAt).toLocaleString()} · To: {m.outbox.recipient}
          </small>
          <h2>{m.outbox.subject}</h2>
          <p className="prewrap">
            {m.outbox.body
              .split(/(https?:\/\/[^\s]+)/)
              .map((v: string, i: number) =>
                /^https?:/.test(v) ? (
                  <a key={i} href={v}>
                    {v}
                  </a>
                ) : (
                  v
                ),
              )}
          </p>
          <span className="badge">Development preview — not delivered</span>
        </article>
      ))}
    </>
  );
}
