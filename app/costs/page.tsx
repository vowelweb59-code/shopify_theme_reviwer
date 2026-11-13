import { redirect } from "next/navigation";

// The Theme Cost page was folded into the Projects page ("Cost by theme", collapsed); old links land there.
export default function CostsPage() {
  redirect("/projects");
}
