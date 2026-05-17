import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { leadsApi, productsApi } from "@/lib/api";
import { toast } from "sonner";

const TAX_RATES = { furniture: 0.0775, appliances: 0.08 };
const DEFAULT_TAX_RATE = 0.0775;
const resolveTaxRate = (category) =>
  TAX_RATES[String(category ?? "").trim().toLowerCase()] ?? DEFAULT_TAX_RATE;

const fmt$ = (v) => (v == null ? "—" : `$${Number(v).toLocaleString()}`);

const EMPTY_FORM = {
  title: "", stage: "NEW", estimated_value: "", notes: "", next_follow_up_date: "",
  product_id: "", quantity: "", discount: "", delivery_fee: "",
};

export default function LeadEditModal({ lead, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [evManual, setEvManual] = useState(false);
  const [products, setProducts] = useState(null);

  // Load products once on mount
  useEffect(() => {
    productsApi.list().then(setProducts).catch(() => {});
  }, []);

  // Seed form from lead when modal opens
  useEffect(() => {
    if (!lead) return;
    setEvManual(false);
    setForm({
      title: lead.title ?? "",
      stage: lead.stage ?? "NEW",
      estimated_value: lead.estimated_value != null ? String(lead.estimated_value) : "",
      notes: lead.notes ?? "",
      next_follow_up_date: lead.next_follow_up_date ?? "",
      product_id: lead.product_id != null ? String(lead.product_id) : "",
      quantity: lead.quantity != null ? String(lead.quantity) : "",
      discount: lead.discount != null ? String(lead.discount) : "",
      delivery_fee: lead.delivery_fee != null ? String(lead.delivery_fee) : "",
    });
  }, [lead]);

  // Auto-calculate estimated_value (copied from CustomerOrders.jsx lines 121–136)
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
    const rate = resolveTaxRate(prod?.category);
    const sub = Math.max(0, up * q - d);
    const tax = prod ? sub * rate : 0;
    const calc = sub + tax + df;
    setForm((f) => ({ ...f, estimated_value: hasInput ? String(calc) : "" }));
  }, [form.product_id, form.quantity, form.discount, form.delivery_fee, evManual, products]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setSel = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setEV = (e) => { setEvManual(true); setForm((f) => ({ ...f, estimated_value: e.target.value })); };

  // Derived display values (copied from CustomerOrders.jsx lines 288–300)
  const productOptions = products ?? [];
  const selectedProduct = form.product_id
    ? productOptions.find((p) => p.id === Number(form.product_id)) ?? null
    : null;
  const unitPrice = selectedProduct?.unit_price ?? 0;
  const formQty = parseFloat(form.quantity) || 0;
  const subtotal = unitPrice * formQty;
  const formDiscount = parseFloat(form.discount) || 0;
  const taxableSubtotal = Math.max(0, subtotal - formDiscount);
  const taxRate = resolveTaxRate(selectedProduct?.category);
  const taxAmount = selectedProduct ? taxableSubtotal * taxRate : 0;
  const taxPct = parseFloat((taxRate * 100).toFixed(2));

  const save = async () => {
    if (!form.title.trim()) return toast.error("Opportunity title is required");
    setSaving(true);
    try {
      await leadsApi.update(lead.id, {
        title: form.title.trim(),
        stage: form.stage,
        notes: form.notes.trim() || null,
        next_follow_up_date: form.next_follow_up_date || null,
        estimated_value: form.estimated_value ? Math.round(parseFloat(form.estimated_value)) : 0,
        product_id: form.product_id ? Number(form.product_id) : null,
        quantity: form.quantity ? parseFloat(form.quantity) : null,
        discount: form.discount ? parseFloat(form.discount) : null,
        delivery_fee: form.delivery_fee ? parseFloat(form.delivery_fee) : null,
      });
      toast.success("Opportunity updated");
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? "Failed to update opportunity");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!lead} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{lead?.title ?? "Edit Opportunity"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">

          {/* Section 1 — Basic fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label>Title <span className="text-red-500">*</span></Label>
              <Input value={form.title} onChange={set("title")} placeholder="e.g. Sofa set inquiry" />
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
              <Label>Next Follow-up Date</Label>
              <Input type="date" value={form.next_follow_up_date} onChange={set("next_follow_up_date")} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={set("notes")} placeholder="Any additional context…" rows={3} />
            </div>
          </div>

          {/* Section 2 — Quote Details */}
          <div>
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Quote Details
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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
                <Input type="number" min={0} placeholder="e.g. 2" value={form.quantity} onChange={set("quantity")} />
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
                <Input type="number" min={0} placeholder="e.g. 100" value={form.discount} onChange={set("discount")} />
              </div>
              <div className="grid gap-2">
                <Label>Delivery Fee ($)</Label>
                <Input type="number" min={0} placeholder="e.g. 50" value={form.delivery_fee} onChange={set("delivery_fee")} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Tax ({taxPct}%)</Label>
                <div className="h-9 px-3 rounded-md border border-zinc-200 bg-zinc-50 text-sm text-zinc-500 flex items-center">
                  {selectedProduct && formQty > 0 ? fmt$(taxAmount) : "—"}
                </div>
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
                <p className="text-xs text-zinc-400">Auto-calculated. You can override.</p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
