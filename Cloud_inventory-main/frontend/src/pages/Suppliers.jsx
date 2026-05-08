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
import { suppliersApi } from "@/lib/api";
import { Plus, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", contact: "" };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => {
    try {
      setSuppliers(await suppliersApi.list());
    } catch {
      toast.error("Failed to load suppliers");
    }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    try {
      await suppliersApi.create({ name: form.name.trim(), contact: form.contact.trim() || null });
      toast.success("Supplier added");
      setOpen(false);
      setForm(empty);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? "Create failed");
    }
  };

  const remove = async (id) => {
    try {
      await suppliersApi.remove(id);
      toast.success("Supplier deleted");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? "Delete failed");
    }
  };

  return (
    <div data-testid="suppliers-page" className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 flex items-center gap-3">
            <Truck className="w-8 h-8 text-sky-600" /> Suppliers
          </h1>
          <p className="text-zinc-500 mt-2">
            Lightweight vendor directory — attach suppliers to restock records to track inbound inventory sources.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setForm(empty); }}>
          <DialogTrigger asChild>
            <Button data-testid="open-create-supplier-btn">
              <Plus className="w-4 h-4 mr-1.5" /> Add supplier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add supplier</DialogTitle>
              <DialogDescription>A supplier is any vendor you restock from.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  data-testid="supplier-name-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Acme Wholesale Co."
                />
              </div>
              <div className="grid gap-2">
                <Label>Contact <span className="text-xs text-zinc-400">(optional)</span></Label>
                <Input
                  data-testid="supplier-contact-input"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  placeholder="email or phone"
                />
              </div>
            </div>
            <DialogFooter>
              <Button data-testid="submit-create-supplier-btn" onClick={create}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card data-testid="suppliers-table-card">
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>{suppliers ? `${suppliers.length} suppliers` : "Loading..."}</CardDescription>
        </CardHeader>
        <CardContent>
          {!suppliers ? (
            <Skeleton className="h-24 w-full" />
          ) : suppliers.length === 0 ? (
            <p className="text-zinc-500 text-sm">No suppliers yet — click "Add supplier" to start.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((s) => (
                    <TableRow key={s.id} data-testid={`supplier-row-${s.id}`}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-sm text-zinc-600">
                        {s.contact || <span className="text-zinc-400">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {new Date(s.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button data-testid={`delete-supplier-${s.id}`} variant="ghost" size="icon">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {s.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Past restock records will be kept but their supplier link will be cleared.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                data-testid={`confirm-delete-supplier-${s.id}`}
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => remove(s.id)}
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
    </div>
  );
}
