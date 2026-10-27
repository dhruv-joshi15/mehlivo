import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventSchema, invitationSchema } from "@/lib/validation";
import {
  eventInclude,
  householdInclude,
  publicEvent,
  token,
  tokenHash,
  totals,
} from "@/lib/domain";
import {
  HttpError,
  ownedEvent,
  privateHousehold,
  saveResponse,
  limit,
} from "@/lib/service";
import { exportEvent } from "@/lib/export";
import { flushOutbox } from "@/lib/mail";
import { ZodError } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    const [area, id, action, detail] = path;
    const method = req.method;
    if (method !== "GET") {
      const origin = req.headers.get("origin");
      if (
        origin &&
        origin !== req.nextUrl.origin &&
        origin !== process.env.BETTER_AUTH_URL
      )
        throw new HttpError(403, "Invalid request origin");
      if (Number(req.headers.get("content-length") ?? 0) > 200000)
        throw new HttpError(413, "Request is too large");
    }
    const json = (data: unknown, status = 200) =>
      NextResponse.json(data, {
        status,
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      });
    if (area === "public") {
      if (method === "GET") {
        const event = await db.event.findFirst({
          where: { id, published: true },
          include: { functions: { orderBy: { startsAt: "asc" } } },
        });
        if (!event) throw new HttpError(404, "Invitation not available");
        return json(publicEvent(event));
      }
      if (method === "POST" && action === "respond") {
        await limit(`public:${id}`);
        return json(await saveResponse(id, await req.json()));
      }
    }
    if (area === "response") {
      const h = await privateHousehold(id);
      if (method === "GET") {
        if (!h.event.published)
          throw new HttpError(403, "The host has unpublished this invitation.");
        const { event, ...response } = h;
        return json({
          event: publicEvent(
            event,
            h.invited ? h.functions.map((f) => f.functionId) : undefined,
          ),
          household: response,
        });
      }
      if (method === "POST") {
        await limit(`response:${h.id}`);
        return json(
          await saveResponse(h.eventId, await req.json(), { privateToken: id }),
        );
      }
    }
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) throw new HttpError(401, "Please sign in");
    if (area === "me")
      return json({
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
        },
        local: process.env.NODE_ENV !== "production",
      });
    if (area === "inbox") {
      if (process.env.NODE_ENV === "production")
        throw new HttpError(404, "Not found");
      await flushOutbox();
      return json(
        await db.developmentMessage.findMany({
          where: { outbox: { recipient: session.user.email } },
          include: { outbox: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      );
    }
    if (area === "events") {
      if (!id && method === "GET")
        return json(
          await db.event
            .findMany({
              where: { hostId: session.user.id },
              include: {
                functions: true,
                _count: { select: { households: true } },
                households: {
                  select: {
                    attendance: { select: { memberId: true, status: true } },
                  },
                },
              },
              orderBy: { updatedAt: "desc" },
            })
            .then((events) =>
              events.map(({ households, ...event }) => ({
                ...event,
                confirmedPeople: new Set(
                  households.flatMap((h) =>
                    h.attendance
                      .filter((a) => a.memberId && a.status === "Attending")
                      .map((a) => a.memberId),
                  ),
                ).size,
              })),
            ),
        );
      if (!id && method === "POST") {
        const input = eventSchema.parse(await req.json());
        const { functions, notify, version, ...data } = input;
        return json(
          await db.event.create({
            data: {
              ...data,
              deadline: data.deadline ? new Date(data.deadline) : null,
              hostId: session.user.id,
              preference: { create: { enabled: notify } },
              functions: {
                create: functions.map(({ id, ...f }) => ({
                  ...f,
                  startsAt: new Date(f.startsAt),
                })),
              },
            },
          }),
          201,
        );
      }
      const event = await ownedEvent(id, session.user.id);
      if (action === "export" && method === "GET")
        return exportEvent(
          event,
          req.nextUrl.searchParams.get("format") ?? "xlsx",
        );
      if (action === "publication" && method === "POST") {
        const input = await req.json();
        if (input.published !== false || !Number.isInteger(input.version))
          throw new HttpError(
            400,
            "Publish through the event editor after validation.",
          );
        const result = await db.event.updateMany({
          where: { id, hostId: session.user.id, version: input.version },
          data: { published: false, version: { increment: 1 } },
        });
        if (!result.count)
          throw new HttpError(
            409,
            "Event changed. Refresh before trying again.",
          );
        return json({ ok: true });
      }
      if (action === "households") {
        if (method === "POST" && detail && path[4] === "replace-link") {
          const household = event.households.find((h) => h.id === detail);
          if (!household) throw new HttpError(404, "Household not found");
          const raw = token();
          await db.$transaction(async (tx) => {
            await tx.privateToken.deleteMany({
              where: { householdId: detail },
            });
            await tx.privateToken.create({
              data: {
                householdId: detail,
                hash: tokenHash(raw),
                kind: household.invited ? "INVITATION" : "MANAGEMENT",
              },
            });
          });
          return json({ token: raw });
        }
        if (method === "POST" && !detail) {
          const data = invitationSchema.parse(await req.json());
          if (
            data.functionIds.some(
              (f) => !event.functions.some((ef) => ef.id === f),
            )
          )
            throw new HttpError(400, "Unknown function");
          const raw = token();
          const household = await db.household.create({
            data: {
              eventId: id,
              name: data.name,
              email: data.email,
              phone: data.phone,
              maxPeople: data.maxPeople,
              invited: true,
              functions: {
                create: data.functionIds.map((functionId) => ({ functionId })),
              },
              tokens: { create: { hash: tokenHash(raw), kind: "INVITATION" } },
            },
            include: householdInclude,
          });
          return json({ household, token: raw }, 201);
        }
        if (method === "PUT" && detail)
          return json(
            await saveResponse(id, await req.json(), {
              householdId: detail,
              hostId: session.user.id,
            }),
          );
      }
      if (action === "respond" && method === "POST")
        return json(
          await saveResponse(id, await req.json(), { hostId: session.user.id }),
        );
      if (method === "GET" && !action)
        return json({
          ...event,
          totals: totals(event),
          metrics: {
            invitedHouseholds: event.households.filter((h) => h.invited).length,
            invitedPeople: event.households
              .filter((h) => h.invited)
              .reduce((s, h) => s + (h.maxPeople ?? 0), 0),
            pendingHouseholds: event.households.filter(
              (h) => h.invited && !h.responded,
            ).length,
          },
        });
      if (method === "PUT" && !action) {
        const data = eventSchema.parse(await req.json());
        const { functions, notify, version, ...fields } = data;
        const result = await db.$transaction(async (tx) => {
          const count = await tx.event.updateMany({
            where: { id, hostId: session.user.id, version: version ?? -1 },
            data: {
              ...fields,
              deadline: fields.deadline ? new Date(fields.deadline) : null,
              version: { increment: 1 },
            },
          });
          if (!count.count)
            throw new HttpError(
              409,
              "Event changed in another window. Reload before editing.",
            );
          const existing = event.functions.map((f) => f.id);
          for (const f of functions)
            if (f.id && !existing.includes(f.id))
              throw new HttpError(400, "Unknown function");
          const removed = existing.filter(
            (f) => !functions.some((n) => n.id === f),
          );
          if (removed.length && event.households.length)
            throw new HttpError(
              400,
              "Functions cannot be removed once households exist.",
            );
          await tx.function.deleteMany({
            where: { eventId: id, id: { in: removed } },
          });
          for (const { id: functionId, ...f } of functions) {
            const values = { ...f, startsAt: new Date(f.startsAt) };
            if (functionId)
              await tx.function.update({
                where: { id: functionId },
                data: values,
              });
            else {
              await tx.function.create({ data: { ...values, eventId: id } });
            }
          }
          await tx.notificationPreference.upsert({
            where: { eventId: id },
            create: { eventId: id, enabled: notify },
            update: { enabled: notify },
          });
          return { id };
        });
        return json(result);
      }
      if (method === "DELETE" && !action) {
        const data = await req.json();
        if (data.confirm !== event.title)
          throw new HttpError(400, "Enter the event title to confirm deletion");
        await db.event.delete({ where: { id } });
        return json({ ok: true });
      }
    }
    throw new HttpError(404, "Not found");
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          error: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        { status: 400 },
      );
    if (error instanceof HttpError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (error instanceof SyntaxError)
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    console.error(
      "Request failed",
      error instanceof Error ? error.name : "Unknown error",
    );
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
