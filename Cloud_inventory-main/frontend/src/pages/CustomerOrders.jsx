import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { customersApi, leadsApi, activitiesApi, crmApi, salesApi, productsApi } from "@/lib/api";
import {
  Users, DollarSign, Calendar, CheckCircle2, XCircle, BarChart2, PieChart,
  Package, Plus, RefreshCcw, ClipboardList, Clock, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

const STAGE_STYLES = {
  NEW: "border-sky-500/40 text-sky-700 bg-sky-500/10",
  CONTACTED: "border-blue-500/40 text-blue-700 bg-blue-500/10",
  QUALIFIED: "border-amber-500/40 text-amber-700 bg-amber-500/10",
  PROPOSAL: "border-orange-500/40 text-orange-700 bg-orange-500/10",
  WON: "border-emerald-500/40 text-emerald-700 bg-emerald-500/10",
  LOST: "border-red-500/40 text-red-700 bg-red-500/10",
};

const STATUS_STYLES = {
  LEAD: "border-sky-500/40 text-sky-700 bg-sky-500/10",
  ACTIVE: "border-emerald-500/40 text-emerald-700 bg-emerald-500/10",
  INACTIVE: "border-zinc-300 text-zinc-500 bg-zinc-100",
};

const fmt$ = (v) => (v == null ? "—" : `$${Number(v).toLocaleString()}`);
const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(); } catch { return "—"; }
};

function StatCard({ title, value, icon: Icon, accent, hint }) {
  return (
    <Card className="border-zinc-200">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-zinc-500 font-medium">{title}</div>
            {value == null ? (
              <Skeleton className="h-8 w-20 mt-2" />
            ) : (
              <div className="text-3xl font-semibold mt-2 tracking-tight">{value}</div>
            )}
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

const EMPTY_FORM = {
  name: "", email: "", phone: "", company: "", status: "LEAD",
  title: "", source: "", stage: "NEW", estimated_value: "",
  owner: "", next_follow_up_date: "", notes: "",
  activity_note: "", activity_due_date: "",
  product_id: "", quantity: "", discount: "", delivery_fee: "",
};

export default function CustomerOrders() {
  const [dashboard, setDashboard] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [leads, setLeads] = useState(null);
  const [activities, setActivities] = useState(null);
  const [sales, setSales] = useState(null);
  const [products, setProducts] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [evManual, setEvManual] = useState(false);

  const load = async () => {
    try {
      const [dash, custs, ls, acts, sl, prods] = await Promise.all([
        crmApi.dashboard(),
        customersApi.list(),
        leadsApi.list(),
        activitiesApi.list(),
        salesApi.list(),
        productsApi.list(),
      ]);
      setDashboard(dash);
      setCustomers(Array.isArray(custs) ? custs : custs?.items ?? custs?.data ?? []);
      setLeads(Array.isArray(ls) ? ls : ls?.items ?? ls?.data ?? []);
      setActivities(Array.isArray(acts) ? acts : acts?.items ?? acts?.data ?? []);
      setSales(Array.isArray(sl) ? sl : sl?.items ?? sl?.data ?? []);
      setProducts(Array.isArray(prods) ? prods : prods?.items ?? prods?.data ?? []);
    } catch {
      toast.error("Failed to load customer orders data");
    }
  };

  useEffect(() => { load(); }, []);

  // Auto-calculate estimated value from quote fields unless user has overridden it manually
  useEffect(() => {
    if (evManual) return;
    const prod = form.product_id
      ? (products ?? []).find((p) => p.id === Number(form.product_id))
      : null;
    const up = prod?.unit_price ?? 0;
    const q = parseFloat(form.quantity) || 0;
    const d = parseFloat(form.discount) || 0;
    const df = parseFloat(form.delivery_fee) || 0;
    const hasInput = !!form.product_id || q > 0 || d > 0 || df > 0;
    const calc = Math.max(0, up * q - d + df);
    setForm((f) => ({ ...f, estimated_value: hasInput ? String(calc) : "" }));
  }, [form.product_id, form.quantity, form.discount, form.delivery_fee, evManual, products]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setSel = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  // Estimated value has a manual override: once the user types here, auto-calc stops updating it
  const setEV = (e) => { setEvManual(true); setForm((f) => ({ ...f, estimated_value: e.target.value })); };

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Customer name is required");

    const productOpts = products ?? [];
    const selectedProd = form.product_id
      ? productOpts.find((p) => p.id === Number(form.product_id)) ?? null
      : null;

    let title = form.title.trim();
    if (!title && selectedProd) title = `${selectedProd.name} × ${form.quantity || 1}`;
    if (!title) return toast.error("Opportunity title is required");

    setSubmitting(true);
    try {
      const customer = await customersApi.create({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        status: form.status,
      });

      let notes = form.notes.trim();
      if (selectedProd) {
        const q = parseFloat(form.quantity) || 0;
        const d = parseFloat(form.discount) || 0;
        const df = parseFloat(form.delivery_fee) || 0;
        const up = selectedProd.unit_price ?? 0;
        const sub = up * q;
        const ev = parseFloat(form.estimated_value) || 0;
        const quoteBlock = [
          "--- Quote Details ---",
          `Product: ${selectedProd.name}${selectedProd.sku ? ` (SKU: ${selectedProd.sku})` : ""}`,
          `Quantity: ${q}`,
          `Unit Price: $${Number(up).toLocaleString()}`,
          `Subtotal: $${Number(sub).toLocaleString()}`,
          `Discount: $${Number(d).toLocaleString()}`,
          `Delivery Fee: $${Number(df).toLocaleString()}`,
          `Estimated Value: $${Number(ev).toLocaleString()}`,
          `Manual Override: ${evManual ? "Yes" : "No"}`,
        ].join("\n");
        notes = notes ? `${notes}\n\n${quoteBlock}` : quoteBlock;
      }

      const lead = await leadsApi.create({
        customer_id: customer.id,
        title,
        source: form.source.trim() || null,
        stage: form.stage,
        estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
        owner: form.owner.trim() || null,
        next_follow_up_date: form.next_follow_up_date || null,
        notes: notes || null,
        product_id: form.product_id ? Number(form.product_id) : null,
        quantity: form.quantity ? parseFloat(form.quantity) : null,
        discount: form.discount ? parseFloat(form.discount) : null,
        delivery_fee: form.delivery_fee ? parseFloat(form.delivery_fee) : null,
      });

      if (form.activity_note.trim() || form.activity_due_date) {
        await activitiesApi.create({
          customer_id: customer.id,
          lead_id: lead.id,
          activity_type: "FOLLOW_UP",
          communication_method: null,
          note: form.activity_note.trim() || null,
          due_date: form.activity_due_date || null,
          completed: false,
        });
      }
      toast.success("Customer inquiry created");
      setForm(EMPTY_FORM);
      setEvManual(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? "Failed to create inquiry");
    } finally {
      setSubmitting(false);
    }
  };

  const markWon = async (id) => {
    try {
      await leadsApi.update(id, { stage: "WON" });
      toast.success("Opportunity marked as WON. Next step: record the actual sale so inventory can be updated.");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? "Update failed");
    }
  };

  const markLost = async (id) => {
    try {
      await leadsApi.update(id, { stage: "LOST" });
      toast.success("Opportunity marked as LOST. No inventory movement is needed.");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? "Update failed");
    }
  };

  const completeActivity = async (id) => {
    try {
      await activitiesApi.complete(id);
      toast.success("Follow-up marked as complete");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? "Complete failed");
    }
  };

  const customerList = customers ?? [];
  const leadList = leads ?? [];
  const activityList = activities ?? [];

  const customerMap = Object.fromEntries(customerList.map((c) => [c.id, c]));
  const activeLeads = leadList.filter((l) => l.stage !== "WON" && l.stage !== "LOST");
  const pendingActivities = activityList.filter((a) => !a.completed);

  // Derived quote values for the form display
  const productOptions = products ?? [];
  const selectedProduct = form.product_id
    ? productOptions.find((p) => p.id === Number(form.product_id)) ?? null
    : null;
  const unitPrice = selectedProduct?.unit_price ?? 0;
  const formQty = parseFloat(form.quantity) || 0;
  const subtotal = unitPrice * formQty;

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
            Customer Orders &amp; Sales Pipeline
          </h1>
          <p className="text-zinc-500 mt-2">
            Track customer inquiries, sales opportunities, and follow-up tasks before they become actual inventory movements.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCcw className="w-4 h-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Pipeline Overview KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Open Opportunities"
          value={dashboard == null ? null : (dashboard.open_leads ?? 0)}
          icon={ClipboardList}
          accent="bg-sky-500/15 text-sky-700"
          hint="Active pipeline"
        />
        <StatCard
          title="Pending Order Value"
          value={dashboard == null ? null : fmt$(dashboard.open_estimated_value)}
          icon={DollarSign}
          accent="bg-emerald-500/15 text-emerald-700"
          hint="Open estimated"
        />
        <StatCard
          title="Upcoming Follow-ups"
          value={dashboard == null ? null : (dashboard.upcoming_follow_ups ?? 0)}
          icon={Calendar}
          accent="bg-amber-500/15 text-amber-700"
          hint="Pending tasks"
        />
        <StatCard
          title="Won Order Value"
          value={dashboard == null ? null : fmt$(dashboard.won_value)}
          icon={CheckCircle2}
          accent="bg-emerald-500/20 text-emerald-700"
          hint="Closed won"
        />
        <StatCard
          title="Lost Order Value"
          value={dashboard == null ? null : fmt$(dashboard.lost_value)}
          icon={XCircle}
          accent="bg-red-500/15 text-red-700"
          hint="Closed lost"
        />
        <StatCard
          title="Total Customers"
          value={dashboard == null ? null : (dashboard.total_customers ?? 0)}
          icon={Users}
          accent="bg-zinc-900 text-zinc-50"
          hint="In CRM"
        />
      </div>

      {/* Pipeline Analytics */}
      <div>
        <h2 className="text-base font-semibold text-zinc-700 mb-3">Pipeline Analytics</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

          {/* 1. Order Outcome Breakdown */}
          {(() => {
            const won  = leadList.filter((l) => l.stage === "WON");
            const lost = leadList.filter((l) => l.stage === "LOST");
            const wonVal  = won.reduce((s, l) => s + (l.estimated_value ?? 0), 0);
            const lostVal = lost.reduce((s, l) => s + (l.estimated_value ?? 0), 0);
            const denom   = won.length + lost.length;
            const winRate = denom > 0 ? Math.round((won.length / denom) * 100) : null;
            const maxVal  = Math.max(wonVal, lostVal, 1);
            return (
              <Card className="border-zinc-200">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-md bg-zinc-100 flex items-center justify-center shrink-0">
                      <PieChart className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-zinc-800 leading-tight">Order Outcome</div>
                      <div className="text-xs text-zinc-400">Won vs. Lost</div>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-emerald-700 font-medium">Won · {won.length}</span>
                        <span className="text-zinc-500">{fmt$(wonVal)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(wonVal / maxVal) * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-red-600 font-medium">Lost · {lost.length}</span>
                        <span className="text-zinc-500">{fmt$(lostVal)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${(lostVal / maxVal) * 100}%` }} />
                      </div>
                    </div>
                    {winRate !== null && (
                      <div className="pt-1 border-t border-zinc-100 flex justify-between items-center">
                        <span className="text-xs text-zinc-500">Win rate</span>
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 bg-emerald-500/10 text-xs">
                          {winRate}%
                        </Badge>
                      </div>
                    )}
                    {winRate === null && (
                      <p className="text-xs text-zinc-400 pt-1">No closed deals yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* 2. Order Value Breakdown by stage */}
          {(() => {
            const OPEN_STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"];
            const stageVals = OPEN_STAGES.map((stage) => ({
              stage,
              value: leadList
                .filter((l) => l.stage === stage)
                .reduce((s, l) => s + (l.estimated_value ?? 0), 0),
            }));
            const maxVal = Math.max(...stageVals.map((s) => s.value), 1);
            const STAGE_BAR = {
              NEW:       "bg-sky-400",
              CONTACTED: "bg-blue-400",
              QUALIFIED: "bg-amber-400",
              PROPOSAL:  "bg-orange-400",
            };
            return (
              <Card className="border-zinc-200">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-md bg-zinc-100 flex items-center justify-center shrink-0">
                      <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-zinc-800 leading-tight">Value by Stage</div>
                      <div className="text-xs text-zinc-400">Open pipeline</div>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {stageVals.map(({ stage, value }) => (
                      <div key={stage}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-zinc-600 font-medium">{stage}</span>
                          <span className="text-zinc-500">{value ? fmt$(value) : "—"}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${STAGE_BAR[stage]}`}
                            style={{ width: `${(value / maxVal) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* 3. Opportunity Stage Breakdown — counts */}
          {(() => {
            const ALL_STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"];
            const total = Math.max(leadList.length, 1);
            const stageCounts = ALL_STAGES.map((stage) => ({
              stage,
              count: leadList.filter((l) => l.stage === stage).length,
            }));
            return (
              <Card className="border-zinc-200">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-md bg-zinc-100 flex items-center justify-center shrink-0">
                      <BarChart2 className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-zinc-800 leading-tight">Stage Breakdown</div>
                      <div className="text-xs text-zinc-400">All opportunities</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {stageCounts.map(({ stage, count }) => (
                      <div key={stage} className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`${STAGE_STYLES[stage] ?? ""} text-[10px] px-1.5 py-0 shrink-0 w-20 justify-center`}
                        >
                          {stage}
                        </Badge>
                        <div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                          <div
                            className="h-full bg-zinc-400 rounded-full"
                            style={{ width: `${(count / total) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-500 tabular-nums w-4 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* 4. Follow-up Status */}
          {(() => {
            const now = new Date();
            const pending   = activityList.filter((a) => !a.completed);
            const completed = activityList.filter((a) => a.completed);
            const overdue   = pending.filter((a) => a.due_date && new Date(a.due_date) < now);
            const total     = Math.max(activityList.length, 1);
            const rows = [
              { label: "Pending",   count: pending.length,   bar: "bg-amber-400",   text: "text-amber-700"  },
              { label: "Completed", count: completed.length, bar: "bg-emerald-500", text: "text-emerald-700" },
              { label: "Overdue",   count: overdue.length,   bar: "bg-red-400",     text: "text-red-600"    },
            ];
            return (
              <Card className="border-zinc-200">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-md bg-zinc-100 flex items-center justify-center shrink-0">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-zinc-800 leading-tight">Follow-up Status</div>
                      <div className="text-xs text-zinc-400">Activity breakdown</div>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {rows.map(({ label, count, bar, text }) => (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className={`font-medium ${text}`}>{label}</span>
                          <span className="text-zinc-500 tabular-nums">{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${bar}`}
                            style={{ width: `${(count / total) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {activityList.length === 0 && (
                      <p className="text-xs text-zinc-400">No activities recorded yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* 5. Best-Selling Products */}
          {(() => {
            const salesList  = sales ?? [];
            const productList2 = products ?? [];
            const productMap2 = Object.fromEntries(productList2.map((p) => [p.id, p]));
            const totals = {};
            salesList.forEach(({ product_id, quantity }) => {
              totals[product_id] = (totals[product_id] ?? 0) + quantity;
            });
            const top5 = Object.entries(totals)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([id, qty]) => ({ name: productMap2[Number(id)]?.name ?? `#${id}`, qty }));
            const maxQty = Math.max(...top5.map((p) => p.qty), 1);
            return (
              <Card className="border-zinc-200">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-md bg-zinc-100 flex items-center justify-center shrink-0">
                      <Package className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-zinc-800 leading-tight">Best-Selling</div>
                      <div className="text-xs text-zinc-400">Top products by units</div>
                    </div>
                  </div>
                  {top5.length === 0 ? (
                    <p className="text-xs text-zinc-400">No sales recorded yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {top5.map(({ name, qty }, idx) => (
                        <div key={idx}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-zinc-700 font-medium truncate max-w-[7rem]">{name}</span>
                            <span className="text-zinc-500 tabular-nums shrink-0 ml-1">{qty} units</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                            <div
                              className="h-full bg-sky-500 rounded-full"
                              style={{ width: `${(qty / maxQty) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

        </div>
      </div>

      {/* Create Customer Inquiry form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-600" /> Create Customer Inquiry
          </CardTitle>
          <CardDescription>
            Log a new customer, opportunity, and optional follow-up in one step.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Customer fields */}
          <div>
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Customer</div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-2">
                <Label>Name <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. Jane Smith" value={form.name} onChange={set("name")} />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" placeholder="jane@example.com" value={form.email} onChange={set("email")} />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input placeholder="+1 555 0100" value={form.phone} onChange={set("phone")} />
              </div>
              <div className="grid gap-2">
                <Label>Company</Label>
                <Input placeholder="Acme Furnishings" value={form.company} onChange={set("company")} />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={setSel("status")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LEAD">Lead</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Opportunity fields */}
          <div>
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Opportunity</div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-2 sm:col-span-2">
                <Label>Title</Label>
                <Input
                  placeholder="e.g. Sofa set inquiry — 3-piece (auto-filled from product if left blank)"
                  value={form.title}
                  onChange={set("title")}
                />
              </div>
              <div className="grid gap-2">
                <Label>Source</Label>
                <Input placeholder="e.g. Walk-in, Referral" value={form.source} onChange={set("source")} />
              </div>
              <div className="grid gap-2">
                <Label>Stage</Label>
                <Select value={form.stage} onValueChange={setSel("stage")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">New</SelectItem>
                    <SelectItem value="CONTACTED">Contacted</SelectItem>
                    <SelectItem value="QUALIFIED">Qualified</SelectItem>
                    <SelectItem value="PROPOSAL">Proposal</SelectItem>
                    <SelectItem value="WON">Won</SelectItem>
                    <SelectItem value="LOST">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Owner</Label>
                <Input placeholder="e.g. Alex" value={form.owner} onChange={set("owner")} />
              </div>
              <div className="grid gap-2">
                <Label>Next Follow-up Date</Label>
                <Input type="date" value={form.next_follow_up_date} onChange={set("next_follow_up_date")} />
              </div>
              <div className="grid gap-2 sm:col-span-2 lg:col-span-4">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Any additional context about this opportunity…"
                  rows={2}
                  value={form.notes}
                  onChange={set("notes")}
                />
              </div>
            </div>
          </div>

          {/* Quote Details */}
          <div>
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Quote Details{" "}
              <span className="font-normal normal-case">(optional — select a product to build a quote)</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-2">
                <Label>Product</Label>
                <Select value={form.product_id} onValueChange={setSel("product_id")}>
                  <SelectTrigger><SelectValue placeholder="Select product…" /></SelectTrigger>
                  <SelectContent>
                    {productOptions.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 2"
                  value={form.quantity}
                  onChange={set("quantity")}
                />
              </div>
              <div className="grid gap-2">
                <Label>Unit Price</Label>
                <div className="h-9 px-3 rounded-md border border-zinc-200 bg-zinc-50 text-sm text-zinc-500 flex items-center">
                  {selectedProduct ? fmt$(unitPrice) : "—"}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Subtotal</Label>
                <div className="h-9 px-3 rounded-md border border-zinc-200 bg-zinc-50 text-sm text-zinc-500 flex items-center">
                  {selectedProduct && formQty > 0 ? fmt$(subtotal) : "—"}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Discount ($)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 100"
                  value={form.discount}
                  onChange={set("discount")}
                />
              </div>
              <div className="grid gap-2">
                <Label>Delivery Fee ($)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 50"
                  value={form.delivery_fee}
                  onChange={set("delivery_fee")}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Estimated Value ($)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 2500"
                  value={form.estimated_value}
                  onChange={setEV}
                />
                <p className="text-xs text-zinc-400">
                  Auto-calculated from product, quantity, discount, and delivery fee. You can override for special quotes.
                </p>
              </div>
            </div>
          </div>

          {/* Optional follow-up activity */}
          <div>
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Follow-up Task{" "}
              <span className="font-normal normal-case">(optional — created only if either field is filled)</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 mt-3">
              <div className="grid gap-2">
                <Label>Follow-up Note</Label>
                <Textarea
                  placeholder="e.g. Call to confirm delivery timeline"
                  rows={2}
                  value={form.activity_note}
                  onChange={set("activity_note")}
                />
              </div>
              <div className="grid gap-2">
                <Label>Due Date</Label>
                <Input type="date" value={form.activity_due_date} onChange={set("activity_due_date")} />
              </div>
            </div>
          </div>

          <Button
            onClick={submit}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {submitting ? "Creating…" : "Create Inquiry"}
          </Button>
        </CardContent>
      </Card>

      {/* Sales Operations Workspace */}
      <div>
        <h2 className="text-base font-semibold text-zinc-700 mb-3">Sales Operations Workspace</h2>
        <Tabs defaultValue="opportunities">
          <TabsList>
            <TabsTrigger value="opportunities">
              <TrendingUp className="w-4 h-4 mr-1.5" />
              Active Opportunities ({activeLeads.length})
            </TabsTrigger>
            <TabsTrigger value="followups">
              <Clock className="w-4 h-4 mr-1.5" />
              Follow-up Tasks ({pendingActivities.length})
            </TabsTrigger>
            <TabsTrigger value="profiles">
              <Users className="w-4 h-4 mr-1.5" />
              Customer Profiles ({customerList.length})
            </TabsTrigger>
          </TabsList>

          {/* Active Opportunities */}
          <TabsContent value="opportunities" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Opportunities</CardTitle>
                <CardDescription>Leads not yet won or lost.</CardDescription>
              </CardHeader>
              <CardContent>
                {leads === null ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : activeLeads.length === 0 ? (
                  <p className="text-zinc-500 text-sm">No active opportunities. Create a customer inquiry to get started.</p>
                ) : (
                  <div className="divide-y">
                    {activeLeads.map((lead) => {
                      const customer = customerMap[lead.customer_id];
                      return (
                        <div key={lead.id} className="py-4 flex items-start justify-between gap-4 flex-wrap">
                          <div className="min-w-0 space-y-1">
                            <div className="font-medium text-zinc-900">{lead.title}</div>
                            <div className="text-sm text-zinc-500">
                              {customer ? (
                                <>
                                  {customer.name}
                                  {customer.company && (
                                    <span className="text-zinc-400"> · {customer.company}</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-zinc-400">Unknown customer</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-500 mt-1">
                              {lead.owner && <span>Owner: {lead.owner}</span>}
                              {lead.next_follow_up_date && (
                                <span>Follow-up: {fmtDate(lead.next_follow_up_date)}</span>
                              )}
                              <span className="font-medium text-zinc-700">{fmt$(lead.estimated_value)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            <Badge
                              variant="outline"
                              className={`${STAGE_STYLES[lead.stage] ?? ""} font-semibold tracking-wide`}
                            >
                              {lead.stage}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => markWon(lead.id)}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Won
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-500/40 text-red-600 hover:bg-red-50"
                              onClick={() => markLost(lead.id)}
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Mark Lost
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Follow-up Tasks */}
          <TabsContent value="followups" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Follow-up Tasks</CardTitle>
                <CardDescription>Pending activities that need action.</CardDescription>
              </CardHeader>
              <CardContent>
                {activities === null ? (
                  <Skeleton className="h-24 w-full" />
                ) : pendingActivities.length === 0 ? (
                  <p className="text-zinc-500 text-sm">No pending follow-ups. All caught up.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Note</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingActivities.map((act) => {
                          const customer = customerMap[act.customer_id];
                          return (
                            <TableRow key={act.id}>
                              <TableCell className="font-medium">
                                {customer ? customer.name : <span className="text-zinc-400">—</span>}
                              </TableCell>
                              <TableCell className="text-sm text-zinc-600 max-w-xs truncate">
                                {act.note || <span className="text-zinc-400">—</span>}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className="border-sky-500/40 text-sky-700 bg-sky-500/10 text-xs"
                                >
                                  {act.activity_type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-zinc-500">
                                {fmtDate(act.due_date)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => completeActivity(act.id)}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Complete
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customer Profiles */}
          <TabsContent value="profiles" className="mt-4">
            {customers === null ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : customerList.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <Users className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
                  <p className="text-zinc-500 text-sm">
                    No customers yet. Create a customer inquiry to get started.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {customerList.map((customer) => {
                  const customerLeads = leadList.filter((l) => l.customer_id === customer.id);
                  const activeOpps = customerLeads.filter((l) => l.stage !== "WON" && l.stage !== "LOST");
                  const pendingVal = activeOpps.reduce((sum, l) => sum + (l.estimated_value ?? 0), 0);
                  const wonVal = customerLeads
                    .filter((l) => l.stage === "WON")
                    .reduce((sum, l) => sum + (l.estimated_value ?? 0), 0);
                  const lostVal = customerLeads
                    .filter((l) => l.stage === "LOST")
                    .reduce((sum, l) => sum + (l.estimated_value ?? 0), 0);
                  const latestActivity = activityList
                    .filter((a) => a.customer_id === customer.id && a.note)
                    .sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0))[0];

                  return (
                    <Card key={customer.id} className="border-zinc-200">
                      <CardContent className="pt-5 pb-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-zinc-900 truncate">{customer.name}</div>
                            {customer.company && (
                              <div className="text-xs text-zinc-400 truncate">{customer.company}</div>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={`${STATUS_STYLES[customer.status] ?? ""} text-xs shrink-0`}
                          >
                            {customer.status}
                          </Badge>
                        </div>
                        {(customer.email || customer.phone) && (
                          <div className="text-xs text-zinc-500 space-y-0.5">
                            {customer.email && <div>{customer.email}</div>}
                            {customer.phone && <div>{customer.phone}</div>}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-zinc-100">
                          <div className="text-xs text-zinc-500">Active opps</div>
                          <div className="text-xs font-medium text-right">{activeOpps.length}</div>
                          <div className="text-xs text-zinc-500">Pending value</div>
                          <div className="text-xs font-medium text-right">
                            {activeOpps.length ? fmt$(pendingVal) : "—"}
                          </div>
                          <div className="text-xs text-zinc-500">Won value</div>
                          <div className="text-xs font-medium text-emerald-700 text-right">
                            {wonVal ? fmt$(wonVal) : "—"}
                          </div>
                          <div className="text-xs text-zinc-500">Lost value</div>
                          <div className="text-xs font-medium text-red-600 text-right">
                            {lostVal ? fmt$(lostVal) : "—"}
                          </div>
                        </div>
                        {latestActivity && (
                          <div className="pt-2 border-t border-zinc-100">
                            <div className="text-xs text-zinc-400">Latest note</div>
                            <div className="text-xs text-zinc-600 truncate mt-0.5">
                              {latestActivity.note}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
