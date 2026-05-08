import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { productsApi } from "@/lib/api";
import { StockBadge } from "@/components/StockBadge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", sku: "", category: "general", stock_qty: 0, reorder_threshold: 10 };

function ProductForm({ value, onChange }) {
  const set = (k) => (e) => {
    const v = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    onChange({ ...value, [k]: v });
  };
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Name</Label>
        <Input data-testid="product-form-name" value={value.name} onChange={set("name")} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>SKU</Label>
          <Input data-testid="product-form-sku" value={value.sku} onChange={set("sku")} />
        </div>
        <div className="grid gap-2">
          <Label>Category</Label>
          <Input data-testid="product-form-category" value={value.category} onChange={set("category")} />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Stock quantity</Label>
          <Input type="number" min={0} data-testid="product-form-stock" value={value.stock_qty} onChange={set("stock_qty")} />
        </div>
        <div className="grid gap-2">
          <Label>Reorder threshold</Label>
          <Input type="number" min={0} data-testid="product-form-threshold" value={value.reorder_threshold} onChange={set("reorder_threshold")} />
        </div>
      </div>
    </div>
  );
}

export default function Products() {
  const [products, setProducts] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    try {
      setProducts(await productsApi.list());
    } catch {
      toast.error("Failed to load products");
    }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name || !form.sku) return toast.error("Name and SKU are required");
    try {
      await productsApi.create(form);
      toast.success("Product created");
      setCreateOpen(false);
      setForm(empty);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? "Create failed");
    }
  };

  const update = async () => {
    try {
      await productsApi.update(editing.id, form);
      toast.success("Product updated");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? "Update failed");
    }
  };

  const remove = async (id) => {
    try {
      await productsApi.remove(id);
      toast.success("Product deleted");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? "Delete failed");
    }
  };

  return (
    <div data-testid="products-page" className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">Products</h1>
          <p className="text-zinc-500 mt-2">Manage your inventory catalog.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (o) setForm(empty); }}>
          <DialogTrigger asChild>
            <Button data-testid="open-create-product-btn">
              <Plus className="w-4 h-4 mr-1.5" /> Add product
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add product</DialogTitle>
              <DialogDescription>Create a new SKU in your inventory.</DialogDescription>
            </DialogHeader>
            <ProductForm value={form} onChange={setForm} />
            <DialogFooter>
              <Button data-testid="submit-create-product-btn" onClick={create}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card data-testid="products-table-card">
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
          <CardDescription>{products ? `${products.length} products` : "Loading..."}</CardDescription>
        </CardHeader>
        <CardContent>
          {!products ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : products.length === 0 ? (
            <p className="text-zinc-500 text-sm">No products yet — click "Add product" to start.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id} data-testid={`product-row-${p.id}`}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs text-zinc-500">{p.sku}</TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell className="text-right">{p.stock_qty}</TableCell>
                      <TableCell className="text-right">{p.reorder_threshold}</TableCell>
                      <TableCell><StockBadge stock={p.stock_qty} threshold={p.reorder_threshold} /></TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          data-testid={`edit-product-${p.id}`}
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditing(p); setForm({ name: p.name, sku: p.sku, category: p.category, stock_qty: p.stock_qty, reorder_threshold: p.reorder_threshold }); }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button data-testid={`delete-product-${p.id}`} variant="ghost" size="icon">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {p.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This deletes the product and all its sales history.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                data-testid={`confirm-delete-${p.id}`}
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => remove(p.id)}
                              >Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
            <DialogDescription>Update SKU details and stock.</DialogDescription>
          </DialogHeader>
          <ProductForm value={form} onChange={setForm} />
          <DialogFooter>
            <Button data-testid="submit-edit-product-btn" onClick={update}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
