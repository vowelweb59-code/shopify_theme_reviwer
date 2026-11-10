import Link from "next/link";
import { listDepartments } from "@/lib/service/api/departments";
import { load } from "@/lib/service/api/http";
import { DepartmentRow, NewDepartment, PeopleDirectory, ProjectManagers } from "./editors";

export const dynamic = "force-dynamic";

const SECTION = "rounded-lg border border-border-subtle bg-surface p-4";

export default async function ServiceDepartmentsPage() {
  const data = await load(() => listDepartments());

  return (
    <div className="space-y-6">
      <div>
        <Link href="/service?tab=departments" className="text-sm text-primary hover:underline">← Department wise report</Link>
        <p className="mt-1 text-sm text-zinc-500">
          A project belongs to the department of its project manager. Each department has one manager; every project that person manages is in it. Projects with no matching manager go to the default department. Hours follow their project and are never lost when a department changes.
        </p>
      </div>

      <section aria-labelledby="list" className={SECTION}>
        <h2 id="list" className="font-medium">Departments ({data.departments.length})</h2>
        {data.departments.length === 0 && <p className="mt-2 text-sm text-zinc-500">None yet. Add the first one below.</p>}
        <ul className="mt-2 divide-y divide-border-subtle">
          {data.departments.map((d) => <DepartmentRow key={d.id} department={d} users={data.users} />)}
        </ul>
        <NewDepartment users={data.users} hasDefault={data.departments.some((d) => d.isDefault)} />
      </section>

      <section aria-labelledby="pm" className={SECTION}>
        <h2 id="pm" className="font-medium">Set project managers</h2>
        <p className="mt-1 text-xs text-zinc-500">Tick the projects a person manages, then add them. This is also how projects move between departments.</p>
        <ProjectManagers users={data.users} projects={data.projects} departments={data.departments.map((d) => ({ id: d.id, name: d.name }))} />
      </section>

      <section aria-labelledby="people" className={SECTION}>
        <h2 id="people" className="font-medium">Managers and staff ({data.directory.length})</h2>
        <p className="mt-1 text-xs text-zinc-500">The people who can manage projects and lead departments. Not logins: everyone uses the app&apos;s shared sign-in.</p>
        <PeopleDirectory people={data.directory} />
      </section>
    </div>
  );
}
