import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLocation } from "react-router-dom";
import { productsApi, salesApi } from "@/lib/api";
import { ShoppingCart, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function RecordSale() {
  const location = useLocation();
  const prefill = location.state?.prefill ?? null;
  const [products, setProducts] = useState(null);
  const [sales, setSales] = useState(null);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const [p, s] = await Promise.all([productsApi.list(), salesApi.list()]);
      setProducts(p);
      setSales(s);
    } catch { toast.error("Failed to load data"); }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!prefill || !products) return;
    if (prefill.product_id) setProductId(String(prefill.product_id));
    if (prefill.quantity) setQuantity(prefill.quantity);
  }, [products]); // run once when products load, so the Select can match the id

  const submit = async () => {
    if (!productId) return toast.error("Select a product");
    if (!quantity || quantity < 1) return toast.error("Quantity must be at least 1");
    setSubmitting(true);
    try {
      await salesApi.create({ product_id: Number(productId), quantity: Number(quantity) });
      toast.success("Sale recorded — stock updated");
      setProductId("");
      setQuantity(1);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? "Failed to record sale");
    } finally {
      setSubmitting(false);
    }
  };

  const productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p]));
  const selectedProduct = productMap[Number(productId)];

  return (
    <div data-testid="record-sale-page" className="space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">Record sale</h1>
        <p className="text-zinc-500 mt-2">Selling a product decreases its stock automatically.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card data-testid="sale-form-card" className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600" /> New sale
            </CardTitle>
            <CardDescription>Pick a product and quantity sold.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger data-testid="sale-product-select">
                  <SelectValue placeholder="Select a product..." />
                </SelectTrigger>
                <SelectContent>
                  {(products ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)} disabled={p.stock_qty <= 0} data-testid={`sale-option-${p.id}`}>
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
              <Label>Quantity</Label>
              <Input
                data-testid="sale-quantity-input"
                type="number"
                min={1}
                max={selectedProduct?.stock_qty ?? undefined}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
              {selectedProduct && (
                <p className="text-xs text-zinc-500">
                  Available: {selectedProduct.stock_qty} units
                </p>
              )}
            </div>
            <Button
              data-testid="submit-sale-btn"
              onClick={submit}
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {submitting ? "Recording..." : "Record sale"}
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="recent-sales-card" className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent sales</CardTitle>
            <CardDescription>Last 25 transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {!sales ? (
              <Skeleton className="h-32 w-full" />
            ) : sales.length === 0 ? (
              <p className="text-zinc-500 text-sm">No sales recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Sold at</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.slice(0, 25).map((s) => (
                      <TableRow key={s.id} data-testid={`sale-row-${s.id}`}>
                        <TableCell>{productMap[s.product_id]?.name ?? `#${s.product_id}`}</TableCell>
                        <TableCell className="text-right font-medium">{s.quantity}</TableCell>
                        <TableCell className="text-xs text-zinc-500">
                          {new Date(s.sold_at).toLocaleString()}
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
    </div>
  );
}
