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
import { customersApi, leadsApi, activitiesApi, crmApi } from "@/lib/api";
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
};

export default function CustomerOrders() {
  const [dashboard, setDashboard] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [leads, setLeads] = useState(null);
  const [activities, setActivities] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const [dash, custs, ls, acts] = await Promise.all([
        crmApi.dashboard(),
        customersApi.list(),
        leadsApi.list(),
        activitiesApi.list(),
      ]);
      setDashboard(dash);
      setCustomers(Array.isArray(custs) ? custs : custs?.items ?? custs?.data ?? []);
      setLeads(Array.isArray(ls) ? ls : ls?.items ?? ls?.data ?? []);
      setActivities(Array.isArray(acts) ? acts : acts?.items ?? acts?.data ?? []);
    } catch {
      toast.error("Failed to load customer orders data");
    }
  };

  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setSel = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Customer name is required");
    if (!form.title.trim()) return toast.error("Opportunity title is required");
    setSubmitting(true);
    try {
      const customer = await customersApi.create({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        status: form.status,
      });
      const lead = await leadsApi.create({
        customer_id: customer.id,
        title: form.title.trim(),
        source: form.source.trim() || null,
        stage: form.stage,
        estimated_value: form.estimated_value ? parseInt(form.estimated_value, 10) : null,
        owner: form.owner.trim() || null,
        next_follow_up_date: form.next_follow_up_date || null,
        notes: form.notes.trim() || null,
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

      {/* Visual Insights placeholder section */}
      <div>
        <h2 className="text-base font-semibold text-zinc-700 mb-3">Pipeline Analytics</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { icon: PieChart, title: "Order Outcome Breakdown", desc: "Won vs. Lost distribution" },
            { icon: DollarSign, title: "Order Value Breakdown", desc: "Revenue by stage" },
            { icon: BarChart2, title: "Opportunity Stage Breakdown", desc: "Pipeline stage counts" },
            { icon: Clock, title: "Follow-up Status", desc: "Pending vs. completed" },
            { icon: Package, title: "Best-Selling Products", desc: "Top inquired products" },
          ].map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="border-zinc-200">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-md bg-zinc-100 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-800 leading-tight">{title}</div>
                    <div className="text-xs text-zinc-400">{desc}</div>
                  </div>
                </div>
                <div className="h-14 rounded-md bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                  <span className="text-xs text-zinc-400">Chart coming soon</span>
                </div>
              </CardContent>
            </Card>
          ))}
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
                <Label>Title <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. Sofa set inquiry — 3-piece" value={form.title} onChange={set("title")} />
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
                <Label>Estimated Value ($)</Label>
                <Input type="number" min={0} placeholder="e.g. 2500" value={form.estimated_value} onChange={set("estimated_value")} />
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
