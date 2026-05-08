import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { productsApi, restocksApi, suppliersApi } from "@/lib/api";
import { PackagePlus, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";

const UNASSIGNED = "__none__";
const ALL_SUPPLIERS = "__all__";
const NO_SUPPLIER = "__nosupplier__";

export default function RecordRestock() {
  const [products, setProducts] = useState(null);
  const [restocks, setRestocks] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [productId, setProductId] = useState("");
  const [supplierId, setSupplierId] = useState(UNASSIGNED);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", contact: "" });
  const [historyFilter, setHistoryFilter] = useState(ALL_SUPPLIERS);

  const loadHistory = async (filter = historyFilter) => {
    let supplierParam;
    if (filter === ALL_SUPPLIERS) supplierParam = undefined;
    else if (filter === NO_SUPPLIER) supplierParam = 0;
    else supplierParam = Number(filter);
    setRestocks(await restocksApi.list(supplierParam));
  };

  const load = async () => {
    try {
      const [p, s] = await Promise.all([
        productsApi.list(),
        suppliersApi.list(),
      ]);
      setProducts(p);
      setSuppliers(s);
      await loadHistory();
    } catch { toast.error("Failed to load data"); }
  };
  useEffect(() => { load(); }, []);

  const onFilterChange = async (val) => {
    setHistoryFilter(val);
    try { await loadHistory(val); }
    catch { toast.error("Failed to filter restocks"); }
  };

  const submit = async () => {
    if (!productId) return toast.error("Select a product");
    if (!quantity || quantity < 1) return toast.error("Quantity must be at least 1");
    setSubmitting(true);
    try {
      await restocksApi.create({
        product_id: Number(productId),
        quantity: Number(quantity),
        note: note.trim() || null,
        supplier_id: supplierId === UNASSIGNED ? null : Number(supplierId),
      });
      toast.success("Restock recorded — stock updated");
      setProductId("");
      setSupplierId(UNASSIGNED);
      setQuantity(1);
      setNote("");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? "Failed to record restock");
    } finally {
      setSubmitting(false);
    }
  };

  const createSupplier = async () => {
    if (!newSupplier.name.trim()) return toast.error("Name is required");
    try {
      const created = await suppliersApi.create({
        name: newSupplier.name.trim(),
        contact: newSupplier.contact.trim() || null,
      });
      toast.success("Supplier added");
      setSupplierDialogOpen(false);
      setNewSupplier({ name: "", contact: "" });
      const list = await suppliersApi.list();
      setSuppliers(list);
      setSupplierId(String(created.id));
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? "Create supplier failed");
    }
  };

  const productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p]));
  const selectedProduct = productMap[Number(productId)];

  return (
    <div data-testid="record-restock-page" className="space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">Record restock</h1>
        <p className="text-zinc-500 mt-2">
          Log inbound inventory — stock quantity is increased automatically.
          Optionally attach a supplier to track sourcing.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card data-testid="restock-form-card" className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-sky-600" /> New restock
            </CardTitle>
            <CardDescription>Inbound stock entry — increases stock_qty.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger data-testid="restock-product-select">
                  <SelectValue placeholder="Select a product..." />
                </SelectTrigger>
                <SelectContent>
                  {(products ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)} data-testid={`restock-option-${p.id}`}>
                      <div className="flex items-center justify-between gap-3 w-full">
                        <span>{p.name}</span>
                        <span className="text-xs text-zinc-500">stock: {p.stock_qty}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Supplier <span className="text-xs text-zinc-400">(optional)</span></Label>
                <Button
                  data-testid="inline-add-supplier-btn"
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setSupplierDialogOpen(true)}
                >
                  <Plus className="w-3 h-3 mr-1" /> New
                </Button>
              </div>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger data-testid="restock-supplier-select">
                  <SelectValue placeholder="(no supplier)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED} data-testid="supplier-option-none">(no supplier)</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)} data-testid={`supplier-option-${s.id}`}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Quantity received</Label>
              <Input
                data-testid="restock-quantity-input"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
              {selectedProduct && (
                <p className="text-xs text-zinc-500">
                  Current stock: {selectedProduct.stock_qty} → After:{" "}
                  <span className="font-semibold">
                    {selectedProduct.stock_qty + (Number(quantity) || 0)}
                  </span>
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Note <span className="text-xs text-zinc-400">(optional)</span></Label>
              <Textarea
                data-testid="restock-note-input"
                rows={2}
                placeholder="e.g. PO-1234"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={255}
              />
            </div>
            <Button
              data-testid="submit-restock-btn"
              onClick={submit}
              disabled={submitting}
              className="w-full bg-sky-600 hover:bg-sky-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {submitting ? "Recording..." : "Record restock"}
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="recent-restocks-card" className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <CardTitle>Recent restocks</CardTitle>
                <CardDescription>
                  {historyFilter === ALL_SUPPLIERS
                    ? "Last 25 inbound movements"
                    : historyFilter === NO_SUPPLIER
                      ? "Restocks without a supplier"
                      : `Restocks from ${suppliers.find((s) => String(s.id) === historyFilter)?.name ?? "supplier"}`}
                </CardDescription>
              </div>
              <div className="min-w-[200px]">
                <Select value={historyFilter} onValueChange={onFilterChange}>
                  <SelectTrigger data-testid="restock-history-filter" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_SUPPLIERS} data-testid="filter-all">All suppliers</SelectItem>
                    <SelectItem value={NO_SUPPLIER} data-testid="filter-none">(no supplier)</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)} data-testid={`filter-supplier-${s.id}`}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!restocks ? (
              <Skeleton className="h-32 w-full" />
            ) : restocks.length === 0 ? (
              <p className="text-zinc-500 text-sm">No restocks recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Restocked at</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {restocks.slice(0, 25).map((r) => (
                      <TableRow key={r.id} data-testid={`restock-row-${r.id}`}>
                        <TableCell>{productMap[r.product_id]?.name ?? `#${r.product_id}`}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-700">
                          +{r.quantity}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-600">
                          {r.supplier?.name ?? <span className="text-zinc-400">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-600 max-w-xs truncate">
                          {r.note || <span className="text-zinc-400">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-zinc-500">
                          {new Date(r.restocked_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add supplier</DialogTitle>
            <DialogDescription>Quickly create a supplier without leaving this page.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                data-testid="inline-supplier-name-input"
                value={newSupplier.name}
                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                placeholder="e.g. Acme Wholesale Co."
              />
            </div>
            <div className="grid gap-2">
              <Label>Contact <span className="text-xs text-zinc-400">(optional)</span></Label>
              <Input
                data-testid="inline-supplier-contact-input"
                value={newSupplier.contact}
                onChange={(e) => setNewSupplier({ ...newSupplier, contact: e.target.value })}
                placeholder="email or phone"
              />
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="inline-submit-supplier-btn" onClick={createSupplier}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
