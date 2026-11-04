import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/mysql-core";
import { employeeApplicationAssociations } from "../drizzle/schema";

const migration = readFileSync(new URL("../drizzle/0075_reviewed_employee_application_associations.sql", import.meta.url), "utf8");

describe("reviewed employee application association migration", () => {
  it("defines application ownership as a unique single-column key in schema and SQL", () => {
    const table = getTableConfig(employeeApplicationAssociations);
    const unique = table.indexes.find(index => index.config.name === "uq_employeeApplicationAssociations_application");
    expect(unique?.config.unique).toBe(true);
    expect(unique?.config.columns.map((column: any) => column.name)).toEqual(["applicationId"]);
    expect(migration).toMatch(/UNIQUE\(`applicationId`\)/);
  });
  it("restricts deletion of the application, canonical application, and employee", () => {
    const table = getTableConfig(employeeApplicationAssociations);
    expect(table.foreignKeys).toHaveLength(3);
    expect(table.foreignKeys.every(key => key.onDelete === "restrict" && key.onUpdate === "restrict")).toBe(true);
    expect((migration.match(/ON DELETE restrict ON UPDATE restrict/g) ?? [])).toHaveLength(3);
    expect(migration).toContain("FOREIGN KEY (`applicationId`) REFERENCES `jobApplications`(`id`)");
    expect(migration).toContain("FOREIGN KEY (`canonicalApplicationId`) REFERENCES `jobApplications`(`id`)");
    expect(migration).toContain("FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`)");
  });
  it("uses MySQL-compatible constraint names and contains no destructive statements", () => {
    const names = [...migration.matchAll(/CONSTRAINT `([^`]+)`/g)].map(match => match[1]);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every(name => name.length <= 64)).toBe(true);
    expect(migration).not.toMatch(/\b(drop|delete|truncate)\s+(table|from)\b/i);
  });
});
