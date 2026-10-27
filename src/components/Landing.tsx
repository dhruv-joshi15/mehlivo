"use client";
import Link from "next/link";
import { useState } from "react";
export function Motif() {
  return (
    <svg className="motif" viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1">
        {Array.from({ length: 12 }, (_, i) => (
          <ellipse
            key={i}
            cx="100"
            cy="66"
            rx="19"
            ry="48"
            transform={`rotate(${i * 30} 100 100)`}
          />
        ))}
        <circle cx="100" cy="100" r="22" />
        <circle cx="100" cy="100" r="84" strokeDasharray="2 7" />
      </g>
    </svg>
  );
}
export function SampleCard() {
  return (
    <div className="sample-card">
      <Motif />
      <p className="eyebrow">Together with our families</p>
      <h2>
        Aarav <em>&</em> Ira
      </h2>
      <p className="sample-script">A new chapter, with you in it.</p>
      <div className="sample-divider" />
      <p>THE WEDDING CELEBRATION</p>
      <strong>Sunday, 14 February 2027</strong>
      <p>The Moonflower Courtyard · Jaipur</p>
      <span className="badge">Sample invitation · Demo</span>
    </div>
  );
}
export function Landing({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <section className="landing-hero">
        <div className="hero-copy">
          <p className="eyebrow">A little invitation. A whole lot of possibility.</p>
          <h1>
            Big moments.
            <br />
            <em>Your kind of magic.</em>
          </h1>
          <p>
            From the first invitation to the final headcount, make space for
            what matters. Your people, all together.
          </p>
          <div className="actions">
            <Link
              className="button"
              href={signedIn ? "/host/events/new" : "/signup"}
            >
              {signedIn ? "Create event" : "Create your event"}{" "}
              <span aria-hidden="true">↗</span>
            </Link>
            <Link className="button secondary" href="/demo">
              See a sample invitation
            </Link>
          </div>
          <p className="hero-note">
            Wedding weekends. Birthday evenings. Every reason to gather.
          </p>
        </div>
        <div className="hero-art">
          <div className="floating-note">
            Made for memories.
            <br />
            <strong>And your favourite people.</strong>
          </div>
          <SampleCard />
          <div className="floating-rsvp">
            <span className="status-dot" />
            Your people. Their replies. All together.
          </div>
        </div>
      </section>
      <section className="landing-section">
        <p className="eyebrow">Less organising. More joy.</p>
        <h2>Good moments start with a simple plan.</h2>
        <div className="grid three">
          {[
            [
              "01",
              "Create",
              "Make it yours",
              "An invitation with your dates, places and a little personality.",
            ],
            [
              "02",
              "Share",
              "Bring everyone in",
              "One link. Family replies. No guest account needed.",
            ],
            [
              "03",
              "Celebrate",
              "Plan with confidence",
              "Clear attendance and optional catering estimates for each function.",
            ],
          ].map(([n, title, sub, text]) => (
            <article className="feature-card" key={n}>
              <span className="step">
                {n} / {title}
              </span>
              <h3>{sub}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="closing-card">
        <Motif />
        <p className="eyebrow">The details, together</p>
        <h2>
          Invitations that feel personal.
          <br />
          Planning that feels lighter.
        </h2>
        <p>
          Thoughtful dress codes, family replies and catering planning.
          <br />
          Everything you need to welcome your people.
        </p>
        <Link className="button" href={signedIn ? "/host" : "/signup"}>
          {signedIn ? "My events" : "Start your celebration"}
        </Link>
      </section>
    </>
  );
}
export function Demo() {
  const [reply, setReply] = useState(false);
  return (
    <div className="invitation">
      <p className="notice">
        Demo invitation · Sample details only. No response is stored or sent.
      </p>
      <SampleCard />
      <section className="card">
        <p className="eyebrow">You're invited</p>
        <h2>A weekend to remember</h2>
        <p>Join us for music, colour and a beautiful beginning.</p>
        <div className="inset">
          <h3>Mehndi · 13 February, 5:00 pm</h3>
          <p>The Moonflower Courtyard, Jaipur · Pastel Indian wear</p>
        </div>
        <div className="inset">
          <h3>Wedding · 14 February, 6:00 pm</h3>
          <p>The Moonflower Courtyard, Jaipur · Traditional attire</p>
        </div>
        <button onClick={() => setReply(!reply)}>
          {reply ? "Close reply preview" : "Try replying to the invitation"}
        </button>
        {reply && (
          <div className="notice">
            <h3>We’d love to have you there.</h3>
            <label className="field">
              Your demo attendance
              <select>
                <option>Attending</option>
                <option>Unable to attend</option>
                <option>Unsure</option>
              </select>
            </label>
            <p>
              This is a preview. Create your event to collect real household
              responses.
            </p>
          </div>
        )}
      </section>
      <Link className="button" href="/signup">
        Create your event
      </Link>
    </div>
  );
}
