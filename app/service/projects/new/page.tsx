import Link from "next/link";
import { NewProjectForm } from "./NewProjectForm";

export default function NewServiceProjectPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link href="/service/projects" className="text-sm text-primary hover:underline">← Projects</Link>
        <h2 className="mt-2 text-xl font-semibold text-zinc-950 dark:text-zinc-50">New project</h2>
      </div>
      <NewProjectForm />
    </div>
  );
}
