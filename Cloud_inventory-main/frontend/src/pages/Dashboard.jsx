import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { productsApi, insightsApi, salesApi, healthApi, suppliersApi } from "@/lib/api";
import { StockBadge } from "@/components/StockBadge";
import { Boxes, AlertTriangle, TrendingDown, ShoppingCart, Sparkles, ArrowRight, RefreshCcw, PackagePlus, Truck } from "lucide-react";
import { toast } from "sonner";

const URGENCY_STYLES = {
  CRITICAL: "border-red-500/40 text-red-700 bg-red-500/10",
  HIGH: "border-orange-500/40 text-orange-700 bg-orange-500/10",
  MODERATE: "border-amber-500/40 text-amber-700 bg-amber-500/10",
  LOW: "border-yellow-500/40 text-yellow-700 bg-yellow-500/10",
  WATCH: "border-sky-500/40 text-sky-700 bg-sky-500/10",
  HEALTHY: "border-emerald-500/40 text-emerald-700 bg-emerald-500/10",
};

function StatCard({ title, value, icon: Icon, accent, testid, hint }) {
  return (
    <Card data-testid={testid} className="border-zinc-200">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-zinc-500 font-medium">{title}</div>
            <div className="text-3xl font-semibold mt-2 tracking-tight">{value}</div>
            {hint && <div className="text-xs text-zinc-400 mt-1">{hint}</div>}
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [products, setProducts] = useState(null);
  const [lowStock, setLowStock] = useState(null);
  const [sales, setSales] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [health, setHealth] = useState(null);
  const [topSuppliers, setTopSuppliers] = useState(null);

  const load = async () => {
    try {
      const [p, l, s, h, t] = await Promise.all([
        productsApi.list(),
        insightsApi.lowStock(),
        salesApi.list(),
        healthApi.check(),
        suppliersApi.top(5),
      ]);
      setProducts(p);
      setLowStock(l);
      setSales(s);
      setHealth(h);
      setTopSuppliers(t);
    } catch (e) {
      toast.error("Failed to load dashboard data");
    }
  };

  const loadAI = async () => {
    setAiLoading(true);
    try {
      const data = await insightsApi.dailyAI();
      setAiSummary(data);
    } catch {
      toast.error("Failed to generate AI summary");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadAI();
  }, []);

  const productList = Array.isArray(products) ? products : products?.items ?? products?.data ?? [];
  const salesList = Array.isArray(sales) ? sales : sales?.items ?? sales?.data ?? [];

  const totalStock = productList.reduce((sum, product) => sum + product.stock_qty, 0);

  const sales7d = salesList
    .filter((sale) => {
      const soldAt = new Date(sale.sold_at);
      return Date.now() - soldAt.getTime() < 7 * 24 * 3600 * 1000;
    })
    .reduce((sum, sale) => sum + sale.quantity, 0);
  const lowStockItems = Array.isArray(lowStock) ? lowStock : lowStock?.items ?? lowStock?.data ?? [];
  const topSupplierItems = Array.isArray(topSuppliers) ? topSuppliers : topSuppliers?.items ?? topSuppliers?.data ?? [];
  return (
    <div data-testid="dashboard-page" className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
            Inventory overview
          </h1>
          <p className="text-zinc-500 mt-2">
            Track stock, sales, and AI-generated restock recommendations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            data-testid="health-status"
            variant="outline"
            className={
              health?.status === "ok"
                ? "border-emerald-500/40 text-emerald-700 bg-emerald-500/10"
                : "border-zinc-300 text-zinc-500"
            }
          >
            <span className={`w-1.5 h-1.5 rounded-full mr-2 ${health?.status === "ok" ? "bg-emerald-500" : "bg-zinc-400"}`} />
            API {health?.status ?? "checking..."}
          </Badge>
          <Button data-testid="dashboard-refresh-btn" variant="outline" size="sm" onClick={load}>
            <RefreshCcw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          testid="stat-products"
          title="Products"
          value={productList.length}
          icon={Boxes}
          accent="bg-zinc-900 text-zinc-50"
        />
        <StatCard
          testid="stat-total-stock"
          title="Total stock units"
          value={totalStock}
          icon={Boxes}
          accent="bg-emerald-500/15 text-emerald-700"
          hint="Across all SKUs"
        />
        <StatCard
          testid="stat-low-stock"
          title="Low-stock items"
          value={lowStockItems.length}
          icon={AlertTriangle}
          accent="bg-amber-500/15 text-amber-700"
          hint="Need reorder"
        />
        <StatCard
          testid="stat-sales-7d"
          title="Sales · last 7 days"
          value={sales7d}
          icon={TrendingDown}
          accent="bg-sky-500/15 text-sky-700"
          hint="Total units sold"
        />
      </div>

      <Card data-testid="ai-daily-card" className="border-emerald-200/70 bg-gradient-to-br from-emerald-50/60 to-white">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <CardTitle className="text-zinc-900">Daily AI restock summary</CardTitle>
                <CardDescription>
                  Generated from rule-based metrics · provider: <span className="font-mono">{aiSummary?.provider ?? "—"}</span>
                </CardDescription>
              </div>
            </div>
            <Button data-testid="regenerate-ai-btn" variant="outline" size="sm" onClick={loadAI} disabled={aiLoading}>
              <RefreshCcw className={`w-4 h-4 mr-1.5 ${aiLoading ? "animate-spin" : ""}`} />
              {aiLoading ? "Generating..." : "Regenerate"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aiSummary ? (
            <p data-testid="ai-summary-text" className="text-zinc-700 leading-relaxed">
              {aiSummary.summary}
            </p>
          ) : (
            <Skeleton className="h-16 w-full" />
          )}
        </CardContent>
      </Card>

      <Card data-testid="low-stock-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Items needing attention</CardTitle>
            <CardDescription>Products flagged by reorder rules.</CardDescription>
          </div>
          <Link to="/insights">
            <Button variant="ghost" size="sm" data-testid="view-all-insights-btn">
              View all <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {!lowStock ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : lowStockItems.length === 0 ? (
            <p className="text-zinc-500 text-sm">All products are at healthy stock levels.</p>
          ) : (
            <div className="divide-y">
              {lowStockItems.slice(0, 5).map((item) => (
                <div
                  key={item.product_id}
                  data-testid={`low-stock-row-${item.product_id}`}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-900 truncate">{item.name}</div>
                    <div className="text-xs text-zinc-500 font-mono">{item.sku}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-sm">
                        <span className="font-semibold">{item.stock_qty}</span>
                        <span className="text-zinc-400"> / {item.reorder_threshold}</span>
                      </div>
                      <div className="text-xs text-zinc-500">
                        reorder ~{item.suggested_reorder_qty}
                      </div>
                    </div>
                    <Badge
                      data-testid={`dashboard-urgency-${item.product_id}`}
                      variant="outline"
                      className={`${URGENCY_STYLES[item.urgency] ?? URGENCY_STYLES.HEALTHY} font-semibold tracking-wide`}
                    >
                      {item.urgency}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-sky-600" /> Top suppliers
            </CardTitle>
            <CardDescription>Ranked by total units supplied (all-time restocks).</CardDescription>
          </div>
          <Link to="/suppliers">
            <Button data-testid="view-suppliers-btn" variant="ghost" size="sm">
              Manage <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {!topSuppliers ? (
            <Skeleton className="h-24 w-full" />
          ) : topSupplierItems.length === 0 ? (
            <p className="text-zinc-500 text-sm">
              No supplier activity yet — attach a supplier when recording a restock to start tracking.
            </p>
          ) : (
            (() => {
              const max = Math.max(...topSupplierItems.map((s) => s.total_units), 1);
              return (
                <div className="space-y-3">
                  {topSupplierItems.map((s, idx) => (
                    <div
                      key={s.supplier_id}
                      data-testid={`top-supplier-${s.supplier_id}`}
                      className="space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-zinc-400 w-4">{idx + 1}.</span>
                          <span className="font-medium text-zinc-900">{s.name}</span>
                        </div>
                        <div className="text-xs text-zinc-500">
                          <span className="font-semibold text-zinc-900">{s.total_units}</span> units · {s.restock_count} restocks
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                        <div
                          className="h-full bg-sky-500 rounded-full transition-all"
                          style={{ width: `${(s.total_units / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Jump straight into common tasks.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/sales">
            <Button data-testid="quick-record-sale-btn" variant="outline" className="w-full justify-start h-auto py-3">
              <ShoppingCart className="w-4 h-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Record a sale</div>
                <div className="text-xs text-zinc-500">Decreases stock</div>
              </div>
            </Button>
          </Link>
          <Link to="/restocks">
            <Button data-testid="quick-record-restock-btn" variant="outline" className="w-full justify-start h-auto py-3">
              <PackagePlus className="w-4 h-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Record a restock</div>
                <div className="text-xs text-zinc-500">Increases stock</div>
              </div>
            </Button>
          </Link>
          <Link to="/products">
            <Button data-testid="quick-add-product-btn" variant="outline" className="w-full justify-start h-auto py-3">
              <Boxes className="w-4 h-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Add a product</div>
                <div className="text-xs text-zinc-500">CRUD inventory</div>
              </div>
            </Button>
          </Link>
          <Link to="/insights">
            <Button data-testid="quick-insights-btn" variant="outline" className="w-full justify-start h-auto py-3">
              <Sparkles className="w-4 h-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">View AI insights</div>
                <div className="text-xs text-zinc-500">Per-product</div>
              </div>
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
