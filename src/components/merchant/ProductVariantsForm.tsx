import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";

export interface VariantEntry {
  variant_type: string;
  variant_value: string;
  price_adjustment: number;
  stock: number;
}

const VARIANT_TYPES = [
  { value: "size", label: "مقاس" },
  { value: "color", label: "لون" },
  { value: "capacity_ml", label: "السعة (ml)" },
];

const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const COLOR_PRESETS = ["أسود", "أبيض", "أحمر", "أزرق", "أخضر", "رمادي", "بيج", "بني"];

interface Props {
  variants: VariantEntry[];
  onChange: (variants: VariantEntry[]) => void;
}

export default function ProductVariantsForm({ variants, onChange }: Props) {
  const [type, setType] = useState("size");
  const [value, setValue] = useState("");
  const [priceAdj, setPriceAdj] = useState("0");
  const [stock, setStock] = useState("0");

  const addVariant = () => {
    if (!value.trim()) return;
    onChange([...variants, {
      variant_type: type,
      variant_value: value.trim(),
      price_adjustment: parseFloat(priceAdj) || 0,
      stock: parseInt(stock) || 0,
    }]);
    setValue("");
    setPriceAdj("0");
    setStock("0");
  };

  const removeVariant = (idx: number) => {
    onChange(variants.filter((_, i) => i !== idx));
  };

  const presets = type === "size" ? SIZE_PRESETS : type === "color" ? COLOR_PRESETS : [];

  return (
    <div className="space-y-3 border border-border rounded-lg p-3">
      <Label className="font-semibold text-sm">خيارات المنتج (اختياري)</Label>

      {variants.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {variants.map((v, i) => (
            <Badge key={i} variant="secondary" className="gap-1 text-xs py-1">
              {VARIANT_TYPES.find(t => t.value === v.variant_type)?.label}: {v.variant_value}
              {v.price_adjustment > 0 && ` (+${v.price_adjustment.toLocaleString()})`}
              <button type="button" onClick={() => removeVariant(i)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">النوع</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VARIANT_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">القيمة</Label>
          <Input className="h-8 text-xs" value={value} onChange={e => setValue(e.target.value)}
            placeholder={type === "capacity_ml" ? "مثال: 100" : "مثال: XL"} />
        </div>
      </div>

      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {presets.map(p => (
            <button key={p} type="button"
              className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground"
              onClick={() => setValue(p)}>
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">فرق السعر (ل.س)</Label>
          <Input className="h-8 text-xs" type="number" min="0" value={priceAdj} onChange={e => setPriceAdj(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">المخزون</Label>
          <Input className="h-8 text-xs" type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} />
        </div>
      </div>

      <Button type="button" variant="outline" size="sm" className="w-full gap-1" onClick={addVariant}>
        <Plus className="h-3 w-3" /> إضافة خيار
      </Button>
    </div>
  );
}
