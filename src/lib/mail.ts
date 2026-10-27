import { db } from "./db";
export interface EmailProvider {
  deliver(id: string): Promise<void>;
}
export const developmentProvider: EmailProvider = {
  async deliver(id) {
    if (process.env.NODE_ENV === "production") return;
    await db.developmentMessage.upsert({
      where: { outboxId: id },
      create: { outboxId: id },
      update: {},
    });
    await db.emailOutbox.update({
      where: { id },
      data: { status: "PREVIEWED" },
    });
  },
};
export async function queueEmail(
  recipient: string,
  subject: string,
  body: string,
  dedupeKey: string,
) {
  return db.emailOutbox.upsert({
    where: { dedupeKey },
    create: { recipient, subject, body, dedupeKey },
    update: {},
  });
}
export async function flushOutbox() {
  for (const mail of await db.emailOutbox.findMany({
    where: { status: "PENDING" },
    take: 100,
  }))
    await developmentProvider.deliver(mail.id);
}
