export const testerMode = process.env.AUTH_TESTER_MODE !== "false";

export function testerEmailAllowed(email: unknown): boolean {
  if (!testerMode) return true;
  if (typeof email !== "string") return false;
  const allowed = (process.env.AUTH_TESTER_EMAILS ?? "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
