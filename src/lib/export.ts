import ExcelJS from "exceljs";
import { safeCell, totals } from "./domain";
export async function exportEvent(event: any, format: string) {
  const rows: any[][] = [
    [
      "Household",
      "Main contact",
      "Email",
      "Phone",
      "Member",
      "Category",
      "Diet",
      "Function",
      "Attendance",
      "Source",
      "Updated at",
    ],
  ];
  for (const h of event.households) {
    for (const f of event.functions) {
      if (h.invited && !h.functions.some((i: any) => i.functionId === f.id))
        continue;
      const status =
        h.attendance.find((a: any) => a.functionId === f.id && !a.memberId)
          ?.status ?? "Pending";
      const members = h.members.filter((m: any) =>
        h.attendance.some(
          (a: any) => a.memberId === m.id && a.functionId === f.id,
        ),
      );
      for (const m of members.length ? members : [null])
        rows.push([
          h.name,
          h.contact,
          h.email,
          h.phone,
          m?.name ?? "",
          m?.category ?? "",
          m?.diet ?? "",
          f.name,
          status,
          h.source,
          h.updatedAt.toISOString(),
        ]);
    }
  }
  if (format === "csv") {
    return new Response(
      "\uFEFF" +
        rows
          .map((r) =>
            r
              .map((v) => '"' + safeCell(v).replaceAll('"', '""') + '"')
              .join(","),
          )
          .join("\r\n"),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="mehlivo-guests.csv"',
        },
      },
    );
  }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Mehlivo";
  const guests = workbook.addWorksheet("Guest list");
  for (const row of rows) guests.addRow(row.map(safeCell));
  const attendance = workbook.addWorksheet("Attendance totals");
  attendance.addRow([
    "Function",
    "Confirmed adults",
    "Confirmed children",
    "Confirmed total",
    "Declined households",
    "Unsure households",
  ]);
  const summary = totals(event);
  for (const t of summary)
    attendance.addRow([
      safeCell(t.name),
      t.adults,
      t.children,
      t.total,
      t.declined,
      t.unsure,
    ]);
  const costs = workbook.addWorksheet("Catering");
  costs.addRow([
    "Function",
    "Currency",
    "Enabled",
    "Adults",
    "Children",
    "Adult rate (rupees)",
    "Child rate (rupees)",
    "Fixed (rupees)",
    "Buffer %",
    "Budget (rupees)",
    "Confirmed estimate (rupees)",
    "Planning adults",
    "Planning children",
    "Buffered estimate (rupees)",
    "Budget minus buffered (rupees)",
    "Child rate assumption",
  ]);
  event.functions.forEach((f: any, i: number) => {
    const t = summary[i],
      r = i + 2;
    costs.addRow([
      safeCell(f.name),
      f.currency,
      f.catering ? "Yes" : "No",
      t.adults,
      t.children,
      f.adultRate / 100,
      (f.childRate ?? f.adultRate) / 100,
      f.fixed / 100,
      f.buffer,
      f.budget === null ? null : f.budget / 100,
      { formula: `D${r}*F${r}+E${r}*G${r}+H${r}`, result: t.confirmed / 100 },
      { formula: `D${r}+ROUNDUP(D${r}*I${r}/100,0)`, result: t.planningAdults },
      {
        formula: `E${r}+ROUNDUP(E${r}*I${r}/100,0)`,
        result: t.planningChildren,
      },
      { formula: `L${r}*F${r}+M${r}*G${r}+H${r}`, result: t.buffered / 100 },
      f.budget === null
        ? ""
        : {
            formula: `J${r}-N${r}`,
            result: t.variance === null ? undefined : t.variance / 100,
          },
      f.childRate === null ? "Uses adult rate" : "Explicit child rate",
    ]);
  });
  event.functions.forEach((f: any, i: number) => {
    const symbol = f.currency === "INR" ? "₹" : f.currency;
    for (const col of [6, 7, 8, 10, 11, 14, 15])
      costs.getCell(i + 2, col).numFmt =
        `"${symbol}" #,##0.00;[Red]-"${symbol}" #,##0.00`;
  });
  for (const sheet of workbook.worksheets) {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.columns.forEach((c) => (c.width = 24));
    sheet.autoFilter = {
      from: "A1",
      to: { row: 1, column: sheet.columnCount },
    };
  }
  const bytes = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="mehlivo-report.xlsx"',
    },
  });
}
