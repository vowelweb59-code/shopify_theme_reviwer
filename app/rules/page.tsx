import { redirect } from "next/navigation";

export default function RulesPage() {
  redirect("/insights?tab=code-review");
}
