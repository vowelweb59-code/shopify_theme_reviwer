import { redirect } from "next/navigation";

export default function PageSpeedPage() {
  redirect("/insights?tab=page-speed");
}
