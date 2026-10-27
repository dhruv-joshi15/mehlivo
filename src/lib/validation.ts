import { z } from "zod";
const text = (max = 200) => z.string().trim().max(max);
const required = text().min(1);
const date = z
  .string()
  .refine((v) => Number.isFinite(Date.parse(v)), "Invalid date");
const money = z.number().int().min(0).max(1_000_000_000);
export const functionSchema = z.object({
  id: z.string().optional(),
  name: required,
  startsAt: date,
  venue: required,
  address: text(1000),
  mapUrl: text(2000).refine((v) => {
    if (!v) return true;
    try {
      const url = new URL(v);
      return ["http:", "https:"].includes(url.protocol) && !!url.hostname;
    } catch {
      return false;
    }
  }, "Use an http or https map URL"),
  themeEnabled: z.boolean(),
  theme: text(),
  outfit: text(1000),
  colours: text(),
  guidance: z.enum(["Suggested", "Requested"]),
  catering: z.boolean(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  adultRate: money,
  childRate: money.nullable(),
  fixed: money,
  budget: money.nullable(),
  buffer: z.number().int().min(0).max(100),
});
export const eventSchema = z.object({
  version: z.number().int().optional(),
  type: z.enum([
    "Wedding",
    "Birthday",
    "Anniversary",
    "House party",
    "Small gathering",
    "Corporate event",
    "Other",
  ]),
  title: required,
  names: required,
  timezone: required.refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Invalid timezone"),
  welcome: text(3000),
  expected: z.number().int().min(0).max(100000),
  deadline: date.nullable(),
  published: z.boolean(),
  notify: z.boolean(),
  functions: z.array(functionSchema).min(1).max(30),
});
export const invitationSchema = z.object({
  name: required,
  email: text().refine(
    (v) => !v || z.email().safeParse(v).success,
    "Invalid email",
  ),
  phone: text(50),
  maxPeople: z.number().int().min(1).max(1000),
  functionIds: z.array(z.string()).min(1).max(30),
});
export const responseSchema = z.object({
  version: z.number().int().min(0).default(0),
  requestKey: z.string().uuid(),
  name: required,
  contact: required,
  email: text().refine(
    (v) => !v || z.email().safeParse(v).success,
    "Invalid email",
  ),
  phone: text(50),
  notes: text(3000),
  source: z.enum(["Guest", "Host", "Confirmed by phone"]).default("Guest"),
  statuses: z
    .array(
      z.object({
        functionId: z.string(),
        status: z.enum(["Attending", "Unable to attend", "Unsure"]),
      }),
    )
    .min(1)
    .max(30),
  members: z
    .array(
      z.object({
        name: required,
        category: z.enum(["Adult", "Child"]),
        diet: z.enum([
          "",
          "Vegetarian",
          "Non-vegetarian",
          "Jain",
          "Vegan",
          "Other",
        ]),
        functionIds: z.array(z.string()).max(30),
      }),
    )
    .max(1000),
});
export type ResponseInput = z.infer<typeof responseSchema>;
