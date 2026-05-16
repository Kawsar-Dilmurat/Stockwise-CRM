import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { customersApi, leadsApi } from "@/lib/api";
import { toast } from "sonner";

const STAGE_STYLES = {
  NEW:       "border-sky-500/40 text-sky-700 bg-sky-500/10",
  CONTACTED: "border-blue-500/40 text-blue-700 bg-blue-500/10",
  QUALIFIED: "border-amber-500/40 text-amber-700 bg-amber-500/10",
  PROPOSAL:  "border-orange-500/40 text-orange-700 bg-orange-500/10",
  WON:       "border-emerald-500/40 text-emerald-700 bg-emerald-500/10",
  LOST:      "border-red-500/40 text-red-700 bg-red-500/10",
};

const EMPTY_FORM = { name: "", email: "", phone: "", company: "", status: "LEAD" };

export default function CustomerEditModal({ customer, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [leads, setLeads] = useState(null);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!customer) return;
    setForm({
      name: customer.name ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      company: customer.company ?? "",
      status: customer.status ?? "LEAD",
    });
    setConfirmDelete(false);
    setLeads(null);
    setLeadsLoading(true);
    leadsApi
      .forCustomer(customer.id)
      .then((data) => setLeads(Array.isArray(data) ? data : data?.items ?? data?.data ?? []))
      .catch(() => setLeads([]))
      .finally(() => setLeadsLoading(false));
  }, [customer]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setSel = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return toast.error("Customer name is required");
    setSaving(true);
    try {
      await customersApi.update(customer.id, {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        status: form.status,
      });
      toast.success("Customer updated");
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? "Failed to update customer");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await customersApi.remove(customer.id);
      toast.success("Customer deleted");
      onDeleted();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? "Failed to delete customer");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={!!customer} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {confirmDelete ? "Delete Customer" : (customer?.name ?? "Edit Customer")}
          </DialogTitle>
        </DialogHeader>

        {confirmDelete ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600">
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-zinc-900">{customer?.name}</span>? This cannot be
              undone.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={doDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Confirm Delete"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label>Name <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={set("name")} placeholder="e.g. Jane Smith" />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={set("email")} placeholder="jane@example.com" />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={set("phone")} placeholder="+1 555 0100" />
              </div>
              <div className="grid gap-2">
                <Label>Company</Label>
                <Input value={form.company} onChange={set("company")} placeholder="Acme Corp" />
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

            <div>
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Opportunities
              </div>
              {leadsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : !leads || leads.length === 0 ? (
                <p className="text-sm text-zinc-400">No opportunities yet.</p>
              ) : (
                <div className="divide-y border rounded-md">
                  {leads.map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between px-3 py-2 gap-2">
                      <span className="text-sm text-zinc-700 truncate">{lead.title}</span>
                      <Badge
                        variant="outline"
                        className={`${STAGE_STYLES[lead.stage] ?? ""} text-xs shrink-0`}
                      >
                        {lead.stage}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 flex-wrap">
              <Button
                variant="outline"
                className="border-red-500/40 text-red-600 hover:bg-red-50 mr-auto"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={save}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
