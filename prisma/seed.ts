import "dotenv/config";
import { db } from "../src/lib/db";
import { auth } from "../src/lib/auth";
import { saveResponse } from "../src/lib/service";
import { token, tokenHash } from "../src/lib/domain";
export async function seed() {
  if (
    process.env.NODE_ENV === "production" ||
    !process.env.DATABASE_URL?.startsWith("file:")
  )
    throw new Error("Seed is local SQLite development only.");
  const hosts = [];
  for (const [name, email] of [
    ["Aarav", "host@mehlivo.test"],
    ["Raj", "other@mehlivo.test"],
  ]) {
    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      const r = await auth.api.signUpEmail({
        body: { name, email, password: "MehlivoLocal!2026" },
      });
      user = await db.user.findUniqueOrThrow({ where: { id: r.user.id } });
    }
    hosts.push(user);
  }
  if (await db.event.findFirst({ where: { hostId: hosts[0].id } })) {
    console.log("Sample events already exist; seed skipped.");
    return;
  }
  const wedding = await db.event.create({
    data: {
      hostId: hosts[0].id,
      type: "Wedding",
      title: "Aarav & Ira · Together Begins Here",
      names: "Aarav & Ira",
      welcome: "Join us for a few beautiful days with our favourite people.",
      expected: 150,
      published: true,
      preference: { create: {} },
      functions: {
        create: [
          {
            name: "Mehndi",
            startsAt: new Date("2027-02-18T10:30:00Z"),
            venue: "The Garden House",
            address: "Jaipur, Rajasthan",
            themeEnabled: true,
            theme: "Pastel Garden",
            outfit:
              "Wear pastel Indian or Western outfits. Floral prints are welcome.",
            colours: "Peach, mint green and cream",
            catering: true,
            adultRate: 75000,
            childRate: 40000,
            fixed: 1000000,
            budget: 2500000,
            buffer: 10,
          },
          {
            name: "Wedding",
            startsAt: new Date("2027-02-19T12:30:00Z"),
            venue: "Rose Courtyard",
            address: "Jaipur, Rajasthan",
            catering: true,
            adultRate: 120000,
            childRate: null,
            fixed: 2000000,
            budget: 6000000,
            buffer: 15,
          },
        ],
      },
    },
    include: { functions: true },
  });
  await db.event.create({
    data: {
      hostId: hosts[1].id,
      type: "House party",
      title: "An Evening Together",
      names: "Raj",
      welcome: "Good food, good company. Come over!",
      expected: 20,
      published: true,
      preference: { create: {} },
      functions: {
        create: {
          name: "House party",
          startsAt: new Date("2027-03-12T13:00:00Z"),
          venue: "Raj’s home",
          address: "Mumbai",
          catering: false,
        },
      },
    },
  });
  for (const [i, name] of [
    "Sharma family",
    "Patel family",
    "Gupta family",
    "Verma family",
  ].entries()) {
    const h = await db.household.create({
      data: {
        eventId: wedding.id,
        name,
        invited: true,
        maxPeople: 4,
        functions: {
          create: wedding.functions.map((f) => ({ functionId: f.id })),
        },
        tokens: { create: { kind: "INVITATION", hash: tokenHash(token()) } },
      },
    });
    if (i < 3)
      await saveResponse(
        wedding.id,
        {
          version: 0,
          requestKey: crypto.randomUUID(),
          name,
          contact: name.split(" ")[0],
          email: "",
          phone: "",
          notes: i === 0 ? "One child needs a mild meal." : "",
          source: "Host",
          statuses: wedding.functions.map((f) => ({
            functionId: f.id,
            status: ["Attending", "Unable to attend", "Unsure"][i],
          })),
          members:
            i === 0
              ? [
                  {
                    name: "Aarav Sharma",
                    category: "Adult",
                    diet: "Vegetarian",
                    functionIds: wedding.functions.map((f) => f.id),
                  },
                  {
                    name: "Riya Sharma",
                    category: "Adult",
                    diet: "Jain",
                    functionIds: wedding.functions.map((f) => f.id),
                  },
                  {
                    name: "Anya Sharma",
                    category: "Child",
                    diet: "Vegetarian",
                    functionIds: wedding.functions.map((f) => f.id),
                  },
                ]
              : [],
        },
        { hostId: hosts[0].id, householdId: h.id },
      );
  }
  console.log(
    "Local seed ready. Hosts: host@mehlivo.test and other@mehlivo.test. Password: MehlivoLocal!2026",
  );
}
seed().finally(() => db.$disconnect());
