import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { insightsApi } from "@/lib/api";
import { Sparkles, RefreshCcw, AlertTriangle, TrendingDown, Boxes } from "lucide-react";
import { toast } from "sonner";

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

const URGENCY_STYLES = {
  CRITICAL: "border-red-500/40 text-red-700 bg-red-500/10",
  HIGH: "border-orange-500/40 text-orange-700 bg-orange-500/10",
  MODERATE: "border-amber-500/40 text-amber-700 bg-amber-500/10",
  LOW: "border-yellow-500/40 text-yellow-700 bg-yellow-500/10",
  WATCH: "border-sky-500/40 text-sky-700 bg-sky-500/10",
  HEALTHY: "border-emerald-500/40 text-emerald-700 bg-emerald-500/10",
};

function UrgencyBadge({ level, testid }) {
  const style = URGENCY_STYLES[level] ?? URGENCY_STYLES.HEALTHY;
  return (
    <Badge data-testid={testid} variant="outline" className={`${style} font-semibold tracking-wide`}>
      {level === "CRITICAL" || level === "HIGH" ? (
        <AlertTriangle className="w-3 h-3 mr-1" />
      ) : null}
      {level}
    </Badge>
  );
}

function InsightCard({ insight, ai, loadingAi, onAi }) {
  const days = insight.estimated_days_left;
  const flagged = insight.reorder_flag;
  return (
    <Card data-testid={`insight-card-${insight.product_id}`} className={flagged ? "border-amber-300" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-zinc-900 truncate">{insight.name}</CardTitle>
            <CardDescription className="font-mono text-xs">{insight.sku} · {insight.category}</CardDescription>
          </div>
          <UrgencyBadge level={insight.urgency} testid={`urgency-badge-${insight.product_id}`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <StatRow label="Stock" value={insight.stock_qty} />
          <StatRow label="Threshold" value={insight.reorder_threshold} />
          <StatRow label="7-day sales" value={insight.recent_7_day_sales} />
          <StatRow label="Avg/day" value={insight.avg_daily_sales} />
          <StatRow
            label="Days left"
            value={days === null ? "—" : `${days}d`}
          />
          <StatRow label="Suggested reorder" value={insight.suggested_reorder_qty} />
        </div>

        <div className="rounded-lg border bg-zinc-50/80 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-700">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> AI recommendation
            </div>
            <Button
              data-testid={`gen-ai-${insight.product_id}`}
              size="sm"
              variant="ghost"
              onClick={onAi}
              disabled={loadingAi}
              className="h-7 px-2 text-xs"
            >
              <RefreshCcw className={`w-3 h-3 mr-1 ${loadingAi ? "animate-spin" : ""}`} />
              {ai ? "Regenerate" : "Generate"}
            </Button>
          </div>
          {ai ? (
            <p className="text-sm text-zinc-700 leading-relaxed">{ai}</p>
          ) : (
            <p className="text-xs text-zinc-400 italic">
              Click "Generate" for an AI-written restock recommendation.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Insights() {
  const [all, setAll] = useState(null);
  const [low, setLow] = useState(null);
  const [aiByProduct, setAiByProduct] = useState({});
  const [loadingAi, setLoadingAi] = useState({});
  const [daily, setDaily] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(false);

  const load = async () => {
    try {
      const [a, l] = await Promise.all([insightsApi.all(), insightsApi.lowStock()]);
      setAll(a);
      setLow(l);
    } catch { toast.error("Failed to load insights"); }
  };
  const loadDaily = async () => {
    setDailyLoading(true);
    try { setDaily(await insightsApi.dailyAI()); }
    catch { toast.error("Failed to generate daily summary"); }
    finally { setDailyLoading(false); }
  };
  useEffect(() => { load(); loadDaily(); }, []);

  const genAi = async (id) => {
    setLoadingAi((m) => ({ ...m, [id]: true }));
    try {
      const data = await insightsApi.productAI(id);
      setAiByProduct((m) => ({ ...m, [id]: data.summary }));
    } catch { toast.error("AI generation failed"); }
    finally { setLoadingAi((m) => ({ ...m, [id]: false })); }
  };

  return (
    <div data-testid="insights-page" className="space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">AI Insights</h1>
        <p className="text-zinc-500 mt-2">
          Rule-based metrics with natural-language recommendations from the AI layer.
          <span className="text-xs text-zinc-400"> · Numbers are calculated, AI only narrates.</span>
        </p>
      </div>

      <Card data-testid="daily-summary-card" className="border-emerald-200/70 bg-gradient-to-br from-emerald-50/60 to-white">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <CardTitle>Today's restock briefing</CardTitle>
                <CardDescription>AI summary of all low-stock items</CardDescription>
              </div>
            </div>
            <Button data-testid="regenerate-daily-btn" variant="outline" size="sm" onClick={loadDaily} disabled={dailyLoading}>
              <RefreshCcw className={`w-4 h-4 mr-1.5 ${dailyLoading ? "animate-spin" : ""}`} /> Regenerate
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {daily ? (
            <p className="text-zinc-700 leading-relaxed">{daily.summary}</p>
          ) : (
            <Skeleton className="h-12 w-full" />
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="low">
        <TabsList>
          <TabsTrigger data-testid="tab-low" value="low">
            <AlertTriangle className="w-4 h-4 mr-1.5" /> Low stock ({low?.count ?? 0})
          </TabsTrigger>
          <TabsTrigger data-testid="tab-all" value="all">
            <Boxes className="w-4 h-4 mr-1.5" /> All products ({all?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="low" className="mt-4">
          {!low ? (
            <Skeleton className="h-40 w-full" />
          ) : low.items.length === 0 ? (
            <Card><CardContent className="py-10 text-center">
              <TrendingDown className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
              <p className="text-zinc-600">All products are at healthy stock levels.</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {low.items.map((i) => (
                <InsightCard
                  key={i.product_id}
                  insight={i}
                  ai={aiByProduct[i.product_id]}
                  loadingAi={!!loadingAi[i.product_id]}
                  onAi={() => genAi(i.product_id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          {!all ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {all.map((i) => (
                <InsightCard
                  key={i.product_id}
                  insight={i}
                  ai={aiByProduct[i.product_id]}
                  loadingAi={!!loadingAi[i.product_id]}
                  onAi={() => genAi(i.product_id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
