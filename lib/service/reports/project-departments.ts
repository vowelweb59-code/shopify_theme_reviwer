// Which department a project belongs to. Owner rule: it follows the project's manager. A project managed by a department's
// manager (for example Huzefa) belongs to that department; a project with no such manager falls into the default one.
import { ServiceDepartment } from "@/models/service-department";
import { ServiceProject } from "@/models/service-project";
import { ServiceUser } from "@/models/service-user";

export type DepartmentRow = { _id: string; name: string; isDefault: boolean; managerUserId: string | null; createdAt: Date; managerName: string | null };

export async function loadProjectDepartments() {
  const [departments, projects, users] = await Promise.all([
    ServiceDepartment.find().sort({ createdAt: 1 }).lean<Array<Omit<DepartmentRow, "managerName">>>(),
    ServiceProject.find().select("name inHouse assignments").lean<Array<{ _id: string; name: string; inHouse: boolean; assignments: Array<{ userId: string; role: string }> }>>(),
    ServiceUser.find().select("displayName").lean<Array<{ _id: string; displayName: string }>>(),
  ]);
  const userName = new Map(users.map((u) => [u._id, u.displayName]));
  const withManager: DepartmentRow[] = departments.map((d) => ({ ...d, managerName: d.managerUserId ? userName.get(d.managerUserId) ?? null : null }));
  const fallback = withManager.find((d) => d.isDefault) ?? null;
  const led = withManager.filter((d) => d.managerUserId);
  const deptOf = new Map<string, string | null>();
  for (const p of projects) {
    const mine = new Set(p.assignments.filter((a) => a.role === "MANAGER").map((a) => a.userId));
    const hit = led.find((d) => mine.has(d.managerUserId!));
    deptOf.set(p._id, hit?._id ?? fallback?._id ?? null);
  }
  return { departments: withManager, deptOf, projects };
}
