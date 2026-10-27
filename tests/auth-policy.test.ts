import { test } from "node:test";
import assert from "node:assert/strict";
import { testerEmailAllowed } from "../src/lib/auth-policy";
test("tester signup denies an empty list and matches exact normalized addresses", () => {
  const previous = process.env.AUTH_TESTER_EMAILS;
  try {
    process.env.AUTH_TESTER_EMAILS = "";
    assert.equal(testerEmailAllowed("tester@example.com"), false);
    process.env.AUTH_TESTER_EMAILS = " Tester@Example.com, other@example.com ";
    assert.equal(testerEmailAllowed("tester@example.com"), true);
    assert.equal(testerEmailAllowed("outsider@example.com"), false);
    assert.equal(testerEmailAllowed("tester@example.com.attacker.test"), false);
    assert.equal(testerEmailAllowed(undefined), false);
  } finally {
    if (previous === undefined) delete process.env.AUTH_TESTER_EMAILS;
    else process.env.AUTH_TESTER_EMAILS = previous;
  }
});
