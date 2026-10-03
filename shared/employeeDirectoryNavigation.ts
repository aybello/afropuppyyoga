export type EmployeeDirectoryTab = "list" | "tree";

export function getEmployeeDirectoryTab(search: string): EmployeeDirectoryTab {
  return new URLSearchParams(search).get("tab") === "tree" ? "tree" : "list";
}

export function employeeDirectoryTabUrl(tab: EmployeeDirectoryTab, search = ""): string {
  const params = new URLSearchParams(search);
  params.set("tab", tab);
  // A completed deep-link edit must not reopen when changing views.
  params.delete("employee");
  return `/admin/employees?${params.toString()}`;
}

export function legacyEmployeeTreeUrl(search: string): string | null {
  const params = new URLSearchParams(search);
  if (params.get("tab") !== "team") return null;
  params.set("tab", "tree");
  return `/admin/employees?${params.toString()}`;
}
