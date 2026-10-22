import { describe, expect, it } from "vitest";
import { and, eq, getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/mysql-core";
import { drizzle } from "drizzle-orm/mysql2";
import { communicationsLog } from "../drizzle/schema";
import { readFileSync } from "node:fs";

const db = drizzle.mock();
const retiredColumnNames = [
  "communicationEntityType",
  "communicationChannel",
  "communicationDirection",
];

function expectPhysicalCommunicationColumns(sql: string) {
  expect(sql).toContain("`entityType`");
  expect(sql).toContain("`channel`");
  expect(sql).toContain("`direction`");
  for (const retiredName of retiredColumnNames) {
    expect(sql).not.toContain(retiredName);
  }
}

describe("communicationsLog schema", () => {
  it("keeps the latest migration snapshot aligned with the physical mapping", () => {
    const journal = JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
    const latest = journal.entries[journal.entries.length - 1].tag.split("_")[0];
    const snapshot = JSON.parse(readFileSync(new URL(`../drizzle/meta/${latest}_snapshot.json`, import.meta.url), "utf8"));
    const table = snapshot.tables.communicationsLog;
    expect(Object.keys(table.columns)).toEqual(Object.values(getTableColumns(communicationsLog)).map(column => column.name));
    for (const [name, column] of Object.entries(table.columns)) {
      expect((column as { name: string }).name).toBe(name);
    }
    expect(table.indexes.idx_communications_entity.columns).toEqual(["entityType", "entityId", "createdAt"]);
    expect(table.indexes.uq_communications_idempotency.columns).toEqual(["idempotencyKey"]);
    expect(table.indexes.uq_communications_idempotency.isUnique).toBe(true);
  });

  it("maps the public properties to the live physical column names", () => {
    const columns = getTableColumns(communicationsLog);

    expect(columns.entityType.name).toBe("entityType");
    expect(columns.channel.name).toBe("channel");
    expect(columns.direction.name).toBe("direction");
    expect(Object.values(columns).map((column) => column.name)).not.toEqual(
      expect.arrayContaining(retiredColumnNames),
    );
  });

  it("retains the live entity, channel, and direction enum values", () => {
    const columns = getTableColumns(communicationsLog);

    expect(columns.entityType.enumValues).toEqual([
      "private_event",
      "job_application",
      "breeder",
      "class",
      "general",
    ]);
    expect(columns.channel.enumValues).toEqual(["email", "sms", "call", "system"]);
    expect(columns.direction.enumValues).toEqual(["outbound", "inbound", "system"]);
  });

  it("retains the entity lookup index and unique idempotency constraint", () => {
    const config = getTableConfig(communicationsLog);
    const indexes = config.indexes.map((index) => ({
      name: index.config.name,
      unique: index.config.unique,
      columns: index.config.columns.map((column) => column.name),
    }));

    expect(config.name).toBe("communicationsLog");
    expect(indexes).toContainEqual({
      name: "idx_communications_entity",
      unique: false,
      columns: ["entityType", "entityId", "createdAt"],
    });
    expect(indexes).toContainEqual({
      name: "uq_communications_idempotency",
      unique: true,
      columns: ["idempotencyKey"],
    });
  });

  it("generates an email insert against the physical columns", () => {
    const query = db.insert(communicationsLog).values({
      entityType: "private_event",
      entityId: 17,
      channel: "email",
      direction: "outbound",
      action: "quote_sent",
      idempotencyKey: "quote:17",
    }).toSQL();

    expectPhysicalCommunicationColumns(query.sql);
    expect(query.sql).toMatch(/^insert into `communicationsLog`/);
    expect(query.params).toEqual(expect.arrayContaining(["private_event", "email", "outbound"]));
  });

  it("generates an SMS select filter against the physical columns", () => {
    const query = db.select()
      .from(communicationsLog)
      .where(and(
        eq(communicationsLog.entityType, "job_application"),
        eq(communicationsLog.channel, "sms"),
        eq(communicationsLog.direction, "inbound"),
      ))
      .toSQL();

    expectPhysicalCommunicationColumns(query.sql);
    expect(query.sql).toContain("from `communicationsLog`");
    expect(query.sql).toContain("where (`communicationsLog`.`entityType` = ? and `communicationsLog`.`channel` = ? and `communicationsLog`.`direction` = ?)");
    expect(query.params).toEqual(["job_application", "sms", "inbound"]);
  });

  it("generates a system update and filter against the physical columns", () => {
    const query = db.update(communicationsLog)
      .set({
        entityType: "general",
        channel: "system",
        direction: "system",
        deliveryStatus: "recorded",
      })
      .where(and(
        eq(communicationsLog.entityType, "general"),
        eq(communicationsLog.channel, "system"),
        eq(communicationsLog.direction, "system"),
      ))
      .toSQL();

    expectPhysicalCommunicationColumns(query.sql);
    expect(query.sql).toMatch(/^update `communicationsLog` set /);
    expect(query.params).toEqual(expect.arrayContaining(["general", "system", "recorded"]));
    expect(query.params.filter((value) => value === "system")).toHaveLength(4);
  });
});
