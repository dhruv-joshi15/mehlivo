import { createHash, randomBytes } from "node:crypto";
export function token() {
  return randomBytes(32).toString("base64url");
}
export function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function catering(
  f: {
    adultRate: number;
    childRate: number | null;
    fixed: number;
    buffer: number;
    budget: number | null;
  },
  adults: number,
  children: number,
) {
  const childRate = f.childRate ?? f.adultRate;
  const planningAdults = adults + Math.ceil((adults * f.buffer) / 100);
  const planningChildren = children + Math.ceil((children * f.buffer) / 100);
  const confirmed = adults * f.adultRate + children * childRate + f.fixed;
  const buffered =
    planningAdults * f.adultRate + planningChildren * childRate + f.fixed;
  return {
    adults,
    children,
    total: adults + children,
    confirmed,
    planningAdults,
    planningChildren,
    planningTotal: planningAdults + planningChildren,
    buffered,
    variance: f.budget === null ? null : f.budget - buffered,
    childRateAssumed: f.childRate === null,
  };
}
export function safeCell(value: unknown) {
  const s = String(value ?? "");
  return /^[\s]*[=+@\-\t\r\n]/.test(s) ? `'${s}` : s;
}
export function totals(event: any) {
  return event.functions.map((f: any) => {
    let adults = 0,
      children = 0,
      declined = 0,
      unsure = 0;
    for (const h of event.households) {
      const status = h.attendance.find(
        (a: any) => a.functionId === f.id && !a.memberId,
      )?.status;
      if (status === "Unable to attend") declined++;
      if (status === "Unsure") unsure++;
      for (const m of h.members) {
        if (
          h.attendance.some(
            (a: any) =>
              a.functionId === f.id &&
              a.memberId === m.id &&
              a.status === "Attending",
          )
        ) {
          if (m.category === "Child") children++;
          else adults++;
        }
      }
    }
    return {
      functionId: f.id,
      name: f.name,
      declined,
      unsure,
      ...catering(f, adults, children),
    };
  });
}
export function publicEvent(event: any, ids?: string[]) {
  return {
    id: event.id,
    title: event.title,
    names: event.names,
    type: event.type,
    welcome: event.welcome,
    timezone: event.timezone,
    deadline: event.deadline,
    functions: event.functions
      .filter((f: any) => !ids || ids.includes(f.id))
      .map((f: any) => ({
        id: f.id,
        name: f.name,
        startsAt: f.startsAt,
        venue: f.venue,
        address: f.address,
        mapUrl: f.mapUrl,
        ...(f.themeEnabled
          ? {
              themeEnabled: true,
              theme: f.theme,
              outfit: f.outfit,
              colours: f.colours,
              guidance: f.guidance,
            }
          : { themeEnabled: false }),
      })),
  };
}
export const householdInclude = {
  members: true,
  attendance: true,
  functions: true,
  history: { orderBy: { createdAt: "desc" as const }, take: 20 },
};
export const eventInclude = {
  functions: { orderBy: { startsAt: "asc" as const } },
  preference: true,
  households: {
    include: householdInclude,
    orderBy: { updatedAt: "desc" as const },
  },
};
