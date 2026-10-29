import { Activity, BarChart3, CalendarClock, DollarSign, FolderKanban, Palette, ShieldCheck, Store, Settings, Users } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/themes", label: "Themes", icon: Palette },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/deadlines", label: "Deadlines", icon: CalendarClock },
  { href: "/team", label: "Team", icon: Users },
  { href: "/current-work", label: "Current Work", icon: Activity },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/sales", label: "Sales", icon: DollarSign },
  { href: "/demo-store", label: "Shopify Theme Store", icon: Store },
  { href: "/insights", label: "Audit Rules", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;
