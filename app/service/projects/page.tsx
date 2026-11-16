import { redirect } from "next/navigation";

// Owner, 2026-11-16: the old projects list is not shown for now; /service is the projects page. The old page is in git history
// (before "Service: /service/projects redirects to /service"); its table is still in ./_components/ProjectsTable.tsx.
export default function ServiceProjectsPage() {
  redirect("/service");
}
