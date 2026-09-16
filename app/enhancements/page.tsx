import { redirect } from "next/navigation";

export default function EnhancementsPage() {
  redirect("/insights?tab=future-updates");
}
