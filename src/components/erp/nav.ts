import {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  CreditCard,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Target,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/erp/types";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  roles: Role[];
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

const both: Role[] = ["admin", "commercial"];
const admin: Role[] = ["admin"];
const commercial: Role[] = ["commercial"];

export const NAV: NavGroup[] = [
  {
    label: "Pilotage",
    items: [
      { title: "Tableau de bord", url: "/tableau-de-bord", icon: LayoutDashboard, roles: both },
      { title: "Mes performances", url: "/performances", icon: Target, roles: commercial },
    ],
  },
  {
    label: "Ventes",
    items: [
      { title: "Clients", url: "/clients", icon: Users, roles: both },
      { title: "Devis", url: "/devis", icon: FileText, roles: both },
      { title: "Commandes", url: "/commandes", icon: ShoppingCart, roles: both },
      { title: "Factures", url: "/factures", icon: Receipt, roles: both },
      { title: "Paiements", url: "/paiements", icon: CreditCard, roles: admin },
    ],
  },
  {
    label: "Catalogue & stock",
    items: [
      { title: "Produits", url: "/produits", icon: Package, roles: both },
      { title: "Stocks", url: "/stocks", icon: Boxes, roles: both },
      { title: "Fournisseurs", url: "/fournisseurs", icon: Truck, roles: admin },
    ],
  },
  {
    label: "Direction",
    items: [
      { title: "Commerciaux", url: "/commerciaux", icon: UserCog, roles: admin },
      { title: "Rapports", url: "/rapports", icon: BarChart3, roles: admin },
    ],
  },
  {
    label: "Suivi",
    items: [
      { title: "Notifications", url: "/notifications", icon: Bell, roles: both },
      { title: "Activités", url: "/activites", icon: Activity, roles: both },
      { title: "Paramètres", url: "/parametres", icon: Settings, roles: admin },
    ],
  },
];

export const navFor = (role: Role) =>
  NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter(
    (g) => g.items.length,
  );

/** Rôles autorisés pour un chemin donné (déduit du menu ; contrôle simulé côté interface). */
export const rolesForPath = (path: string): Role[] => {
  for (const g of NAV)
    for (const i of g.items) if (path === i.url || path.startsWith(i.url + "/")) return i.roles;
  return both;
};
