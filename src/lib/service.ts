import { db } from "./db";
import { createHmac } from "node:crypto";
import {
  householdInclude,
  eventInclude,
  tokenHash,
  token,
  totals,
} from "./domain";
import { responseSchema } from "./validation";
import { flushOutbox } from "./mail";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function ownedEvent(id: string, userId: string) {
  const event = await db.event.findFirst({
    where: { id, hostId: userId },
    include: eventInclude,
  });
  if (!event) throw new HttpError(404, "Event not found");
  return event;
}
export async function privateHousehold(value: string) {
  if (value.length > 100) throw new HttpError(404, "Private link not found");
  const t = await db.privateToken.findUnique({
    where: { hash: tokenHash(value) },
    include: {
      household: {
        include: {
          ...householdInclude,
          event: { include: { functions: true } },
        },
      },
    },
  });
  if (!t) throw new HttpError(404, "Private link not found");
  return t.household;
}
export async function limit(key: string) {
  const now = new Date();
  await db.$transaction(async (tx) => {
    const old = await tx.rateLimit.findUnique({ where: { key } });
    if (!old || old.expiresAt < now) {
      await tx.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, expiresAt: new Date(Date.now() + 60000) },
        update: { count: 1, expiresAt: new Date(Date.now() + 60000) },
      });
      return;
    }
    if (old.count >= 30)
      throw new HttpError(429, "Too many submissions. Please wait one minute.");
    await tx.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
  });
}
export async function saveResponse(
  eventId: string,
  raw: unknown,
  options: {
    householdId?: string;
    hostId?: string;
    privateToken?: string;
  } = {},
) {
  const input = responseSchema.parse(raw);
  const managementToken = createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
    .update("response:" + input.requestKey)
    .digest("base64url");
  const result = await db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: eventInclude,
    });
    if (!event) throw new HttpError(404, "Event not found");
    const isHost = !!options.hostId && event.hostId === options.hostId;
    if (options.hostId && !isHost) throw new HttpError(404, "Event not found");
    let household = options.householdId
      ? event.households.find((h) => h.id === options.householdId)
      : undefined;
    if (options.privateToken) {
      const t = await tx.privateToken.findUnique({
        where: { hash: tokenHash(options.privateToken) },
      });
      household = event.households.find((h) => h.id === t?.householdId);
      if (!household) throw new HttpError(404, "Private link not found");
    }
    if (options.householdId && !household)
      throw new HttpError(404, "Household not found");
    if (
      !isHost &&
      (!event.published || (event.deadline && event.deadline < new Date()))
    )
      throw new HttpError(
        403,
        "Responses are closed. Please contact the host.",
      );
    if (!household) {
      const existing = await tx.household.findUnique({
        where: { requestKey: input.requestKey },
      });
      if (existing) {
        if (existing.eventId !== eventId)
          throw new HttpError(409, "Request already used");
        return { id: existing.id, replayed: true, managementToken };
      }
    }
    const allowed = household?.invited
      ? household.functions.map((f) => f.functionId)
      : event.functions.map((f) => f.id);
    if (
      input.statuses.length !== allowed.length ||
      new Set(input.statuses.map((s) => s.functionId)).size !==
        allowed.length ||
      input.statuses.some((s) => !allowed.includes(s.functionId))
    )
      throw new HttpError(
        400,
        "Respond to each invited function exactly once.",
      );
    const attending = input.statuses
      .filter((s) => s.status === "Attending")
      .map((s) => s.functionId);
    if (household?.maxPeople && input.members.length > household.maxPeople)
      throw new HttpError(
        400,
        `This invitation allows up to ${household.maxPeople} people.`,
      );
    if (attending.length && !input.members.length)
      throw new HttpError(400, "Add everyone attending, including you.");
    for (const id of attending)
      if (!input.members.some((m) => m.functionIds.includes(id)))
        throw new HttpError(
          400,
          "Select at least one member for each attending function.",
        );
    for (const m of input.members)
      if (
        new Set(m.functionIds).size !== m.functionIds.length ||
        m.functionIds.some((id) => !attending.includes(id))
      )
        throw new HttpError(
          400,
          "Member attendance must match attending functions.",
        );
    const meaningful = JSON.stringify({
      name: input.name,
      contact: input.contact,
      email: input.email,
      phone: input.phone,
      notes: input.notes,
      statuses: input.statuses,
      members: input.members,
    });
    const latest = household?.history[0];
    if (household && latest?.after === meaningful)
      return { id: household.id, replayed: true };
    const beforeTotals = totals(event).map((t: any) => ({
      name: t.name,
      adults: t.adults,
      children: t.children,
      total: t.total,
    }));
    const source = isHost
      ? input.source === "Confirmed by phone"
        ? "Confirmed by phone"
        : "Host"
      : "Guest";
    if (household) {
      const changed = await tx.household.updateMany({
        where: { id: household.id, version: input.version },
        data: { version: { increment: 1 } },
      });
      if (!changed.count)
        throw new HttpError(
          409,
          "This response changed in another window. Reload before editing.",
        );
    } else
      household = await tx.household.create({
        data: { eventId, name: input.name, requestKey: input.requestKey },
        include: householdInclude,
      });
    const id = household.id;
    await tx.attendance.deleteMany({ where: { householdId: id } });
    await tx.member.deleteMany({ where: { householdId: id } });
    await tx.household.update({
      where: { id },
      data: {
        name: input.name,
        contact: input.contact,
        email: input.email,
        phone: input.phone,
        notes: input.notes,
        responded: true,
        source,
      },
    });
    for (const status of input.statuses)
      await tx.attendance.create({ data: { householdId: id, ...status } });
    for (const member of input.members) {
      const m = await tx.member.create({
        data: {
          householdId: id,
          name: member.name,
          category: member.category,
          diet: member.diet,
        },
      });
      for (const functionId of member.functionIds)
        await tx.attendance.create({
          data: {
            householdId: id,
            memberId: m.id,
            functionId,
            status: "Attending",
          },
        });
    }
    const history = await tx.changeHistory.create({
      data: {
        householdId: id,
        before: latest?.after ?? "{}",
        after: meaningful,
        source,
      },
    });
    if (!options.privateToken && !options.householdId)
      await tx.privateToken.create({
        data: {
          householdId: id,
          kind: "RESPONSE",
          hash: tokenHash(managementToken),
        },
      });
    if (!isHost && event.preference?.enabled !== false) {
      const updated = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        include: eventInclude,
      });
      const afterTotals = totals(updated).map((t: any) => ({
        name: t.name,
        adults: t.adults,
        children: t.children,
        total: t.total,
      }));
      const householdCounts = (data: any) =>
        event.functions.map((f) => ({
          function: f.name,
          adults: (data?.members ?? []).filter(
            (m: any) => m.category === "Adult" && m.functionIds.includes(f.id),
          ).length,
          children: (data?.members ?? []).filter(
            (m: any) => m.category === "Child" && m.functionIds.includes(f.id),
          ).length,
        }));
      const beforeHousehold = householdCounts(
        latest ? JSON.parse(latest.after) : null,
      );
      const afterHousehold = householdCounts(input);
      const host = await tx.user.findUniqueOrThrow({
        where: { id: event.hostId },
      });
      await tx.emailOutbox.create({
        data: {
          dedupeKey: `response:${history.id}`,
          recipient: host.email,
          subject: `${event.title}: ${input.name} ${latest ? "updated their response" : "responded"}`,
          body: `Household: ${input.name}\nAttendance: ${input.statuses.map((s) => `${event.functions.find((f) => f.id === s.functionId)?.name}: ${s.status}`).join(", ")}\nBefore household counts: ${JSON.stringify(beforeHousehold)}\nAfter household counts: ${JSON.stringify(afterHousehold)}\nBefore event counts: ${JSON.stringify(beforeTotals)}\nAfter event counts: ${JSON.stringify(afterTotals)}\n${process.env.BETTER_AUTH_URL}/host/events/${eventId}`,
        },
      });
    }
    return {
      id,
      managementToken:
        !options.privateToken && !options.householdId
          ? managementToken
          : undefined,
    };
  });
  try {
    await flushOutbox();
  } catch {
    /* RSVP is committed; pending outbox retries on inbox refresh. */
  }
  return result;
}
