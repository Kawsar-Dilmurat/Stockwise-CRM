import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import RecordSale from "@/pages/RecordSale";
import RecordRestock from "@/pages/RecordRestock";
import Suppliers from "@/pages/Suppliers";
import Insights from "@/pages/Insights";
import { LayoutDashboard, Package, ShoppingCart, Sparkles, PackagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

const mobileLinks = [
  { to: "/", label: "Home", icon: LayoutDashboard, testid: "mnav-dashboard" },
  { to: "/products", label: "Products", icon: Package, testid: "mnav-products" },
  { to: "/sales", label: "Sale", icon: ShoppingCart, testid: "mnav-sales" },
  { to: "/restocks", label: "Restock", icon: PackagePlus, testid: "mnav-restocks" },
  { to: "/insights", label: "Insights", icon: Sparkles, testid: "mnav-insights" },
];

function MobileNav() {
  return (
    <nav
      data-testid="mobile-nav"
      className="md:hidden fixed bottom-0 inset-x-0 bg-zinc-950 text-zinc-100 border-t border-zinc-800 grid grid-cols-5 z-30"
    >
      {mobileLinks.map(({ to, label, icon: Icon, testid }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          data-testid={testid}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center justify-center py-2 text-xs gap-1",
              isActive ? "text-emerald-400" : "text-zinc-400"
            )
          }
        >
          <Icon className="w-4 h-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex bg-zinc-50 text-zinc-900">
        <Sidebar />
        <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 sm:py-10 pb-24 md:pb-10 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/sales" element={<RecordSale />} />
            <Route path="/restocks" element={<RecordRestock />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/insights" element={<Insights />} />
          </Routes>
        </main>
        <MobileNav />
        <Toaster position="top-right" richColors />
      </div>
    </BrowserRouter>
  );
}
