import { test } from "node:test";
import assert from "node:assert/strict";
import { catering, safeCell, publicEvent } from "../src/lib/domain";
test("buffer rounds each category up and adds fixed charges once", () => {
  assert.deepEqual(
    catering(
      {
        adultRate: 10000,
        childRate: 5000,
        fixed: 1234,
        buffer: 10,
        budget: 60000,
      },
      3,
      1,
    ),
    {
      adults: 3,
      children: 1,
      total: 4,
      confirmed: 36234,
      planningAdults: 4,
      planningChildren: 2,
      planningTotal: 6,
      buffered: 51234,
      variance: 8766,
      childRateAssumed: false,
    },
  );
});
test("missing child rate uses adult rate; zero explicit child rate stays zero", () => {
  assert.equal(
    catering(
      { adultRate: 10000, childRate: null, fixed: 0, buffer: 0, budget: null },
      2,
      1,
    ).confirmed,
    30000,
  );
  assert.equal(
    catering(
      { adultRate: 10000, childRate: 0, fixed: 0, buffer: 0, budget: null },
      2,
      1,
    ).confirmed,
    20000,
  );
});
test("spreadsheet formulas are escaped including leading whitespace", () => {
  for (const s of ["=SUM(A1)", " +2", "-3", "@x", "\t=2"])
    assert.equal(safeCell(s), "'" + s);
  assert.equal(safeCell("Sharma family"), "Sharma family");
});
test("public event never exposes catering, households, host ID or hidden theme", () => {
  const event = publicEvent(
    {
      id: "1",
      title: "Party",
      hostId: "secret",
      households: [{ name: "secret" }],
      functions: [
        {
          id: "a",
          themeEnabled: false,
          theme: "hidden",
          adultRate: 100,
          budget: 1000,
        },
        { id: "b", themeEnabled: true, theme: "Garden" },
      ],
    },
    ["a"],
  );
  assert.equal(event.functions.length, 1);
  assert.equal("budget" in event.functions[0], false);
  assert.equal("theme" in event.functions[0], false);
  assert.equal("households" in event, false);
});

import { functionSchema } from "../src/lib/validation";
test("map links must be complete HTTP(S) URLs", () => {
  const map = functionSchema.shape.mapUrl;
  for (const value of [
    "javascript:alert(1)",
    "https://",
    "not a URL",
    "ftp://example.com",
  ])
    assert.equal(map.safeParse(value).success, false);
  for (const value of ["", "https://maps.google.com/?q=Jaipur"])
    assert.equal(map.safeParse(value).success, true);
});
