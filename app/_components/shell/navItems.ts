import { Palette, ShieldCheck, Store, Settings } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/themes", label: "Themes", icon: Palette },
  { href: "/demo-store", label: "Shopify Demo Store", icon: Store },
  { href: "/insights", label: "Audit Rules", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;
