import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StockBadge({ stock, threshold }) {
  let label = "Healthy";
  let style = "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300";
  if (stock <= 0) {
    label = "Out of stock";
    style = "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-300";
  } else if (stock <= threshold) {
    label = "Low stock";
    style = "bg-amber-500/15 text-amber-800 border-amber-500/40 dark:text-amber-300";
  }
  return (
    <Badge data-testid="stock-badge" variant="outline" className={cn("font-medium", style)}>
      {label}
    </Badge>
  );
}
