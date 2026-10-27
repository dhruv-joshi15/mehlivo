import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { saveResponse } from "../src/lib/service";
import { developmentProvider, flushOutbox } from "../src/lib/mail";
test("delivery failure preserves the committed RSVP and retries without duplicate messages", { skip: "Requires an isolated PostgreSQL test database after provider migration; never run against Supabase production." }, async () => {
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.ok(process.env.DATABASE_URL?.startsWith("file:"));
  const id = crypto.randomUUID(),
    email = `outbox-${id}@example.test`;
  const original = developmentProvider.deliver;
  try {
    await db.user.create({ data: { id, email, name: "Outbox test" } });
    const event = await db.event.create({
      data: {
        hostId: id,
        type: "Other",
        title: "Outbox test",
        names: "Test",
        published: true,
        preference: { create: {} },
        functions: {
          create: {
            name: "Party",
            startsAt: new Date("2027-01-01T12:00:00Z"),
            venue: "Test",
            address: "",
          },
        },
      },
      include: { functions: true },
    });
    developmentProvider.deliver = async () => {
      throw new Error("Deliberate test delivery failure");
    };
    const input = {
      version: 0,
      requestKey: crypto.randomUUID(),
      name: "Outbox family",
      contact: "Test Guest",
      email: "",
      phone: "",
      notes: "",
      source: "Guest",
      statuses: [
        { functionId: event.functions[0].id, status: "Unable to attend" },
      ],
      members: [],
    };
    const saved = await saveResponse(event.id, input);
    assert.ok(saved.managementToken);
    assert.equal(
      (await db.household.findUniqueOrThrow({ where: { id: saved.id } }))
        .responded,
      true,
    );
    const mail = await db.emailOutbox.findFirstOrThrow({
      where: { recipient: email },
    });
    assert.equal(mail.status, "PENDING");
    assert.equal(
      await db.developmentMessage.count({ where: { outboxId: mail.id } }),
      0,
    );
    developmentProvider.deliver = original;
    await flushOutbox();
    await flushOutbox();
    await saveResponse(event.id, input);
    assert.equal(
      await db.developmentMessage.count({ where: { outboxId: mail.id } }),
      1,
    );
    assert.equal(
      await db.emailOutbox.count({ where: { recipient: email } }),
      1,
    );
  } finally {
    developmentProvider.deliver = original;
    await db.user.deleteMany({ where: { id } });
    await db.emailOutbox.deleteMany({ where: { recipient: email } });
    await db.$disconnect();
  }
});
