import { NavLink } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart, Sparkles, Boxes, PackagePlus, Truck, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/products", label: "Products", icon: Package, testid: "nav-products" },
  { to: "/sales", label: "Record Sale", icon: ShoppingCart, testid: "nav-sales" },
  { to: "/customer-orders", label: "Customer Orders", icon: ClipboardList, testid: "nav-customer-orders" },
  { to: "/restocks", label: "Record Restock", icon: PackagePlus, testid: "nav-restocks" },
  { to: "/suppliers", label: "Suppliers", icon: Truck, testid: "nav-suppliers" },
  { to: "/insights", label: "AI Insights", icon: Sparkles, testid: "nav-insights" },
];

export default function Sidebar() {
  return (
    <aside
      data-testid="app-sidebar"
      className="hidden md:flex md:w-64 md:flex-col bg-zinc-950 text-zinc-100 border-r border-zinc-800 min-h-screen"
    >
      <div className="px-6 py-7 border-b border-zinc-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
          <Boxes className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <div className="font-semibold tracking-tight text-zinc-50" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
            stockwise
          </div>
          <div className="text-xs text-zinc-500">inventory · ai insights</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-5 space-y-1">
        {links.map(({ to, label, icon: Icon, testid }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            data-testid={testid}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-transparent"
              )
            }
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-6 py-4 border-t border-zinc-800 text-xs text-zinc-500">
        <div>v1.0.0 · FastAPI · Postgres</div>
        <div className="mt-1">AI: rule-based + mock LLM</div>
      </div>
    </aside>
  );
}
