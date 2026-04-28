import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Loader2, Scale, Save } from "lucide-react";
import { toast } from "sonner";

const MAX_TIERS = 15;

interface Tier {
  id?: string;
  min_weight: number | string;
  max_weight: number | string;
  base_price: number | string;
  extra_kg_price: number | string;
  _deleted?: boolean;
}

interface Props {
  courierId: string;
}

export default function CourierPricingTiers({ courierId }: Props) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalIds, setOriginalIds] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("courier_pricing_tiers" as any)
      .select("*")
      .eq("courier_id", courierId)
      .order("min_weight", { ascending: true });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const rows = (data as any[]) || [];
    setTiers(rows.map(r => ({
      id: r.id,
      min_weight: r.min_weight,
      max_weight: r.max_weight,
      base_price: r.base_price,
      extra_kg_price: r.extra_kg_price,
    })));
    setOriginalIds(new Set(rows.map(r => r.id)));
  };

  useEffect(() => { if (courierId) load(); }, [courierId]);

  const addTier = () => {
    if (tiers.filter(t => !t._deleted).length >= MAX_TIERS) {
      toast.error(`الحد الأقصى ${MAX_TIERS} شريحة`);
      return;
    }
    const last = [...tiers].filter(t => !t._deleted).pop();
    const minStart = last ? Number(last.max_weight) || 0 : 0;
    setTiers([...tiers, {
      min_weight: minStart,
      max_weight: minStart + 5,
      base_price: 0,
      extra_kg_price: 0,
    }]);
  };

  const updateTier = (idx: number, field: keyof Tier, value: string) => {
    setTiers(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const removeTier = (idx: number) => {
    setTiers(prev => prev.map((t, i) => i === idx ? { ...t, _deleted: true } : t));
  };

  const validate = (): string | null => {
    const active = tiers.filter(t => !t._deleted);
    if (active.length === 0) return "أضف شريحة واحدة على الأقل";
    const norm = active.map((t, i) => ({
      i,
      min: Number(t.min_weight),
      max: Number(t.max_weight),
      base: Number(t.base_price),
      extra: Number(t.extra_kg_price),
    }));
    for (const r of norm) {
      if ([r.min, r.max, r.base, r.extra].some(v => isNaN(v))) return `قيمة رقمية غير صالحة في الصف ${r.i + 1}`;
      if (r.min < 0 || r.base < 0 || r.extra < 0) return `لا يُسمح بقيم سالبة في الصف ${r.i + 1}`;
      if (r.max <= r.min) return `الحد الأقصى يجب أن يكون أكبر من الحد الأدنى في الصف ${r.i + 1}`;
    }
    // Overlap check — treat ranges as half-open [min, max) so touching edges (e.g. 0-5 and 5-10) are allowed
    for (let i = 0; i < norm.length; i++) {
      for (let j = i + 1; j < norm.length; j++) {
        const a = norm[i], b = norm[j];
        const overlap = Math.max(a.min, b.min) < Math.min(a.max, b.max);
        if (overlap) {
          return `تتداخل الشريحة [${a.min}–${a.max}] (الصف ${a.i + 1}) مع الشريحة [${b.min}–${b.max}] (الصف ${b.i + 1})`;
        }
      }
    }
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);

    // Determine deletions (existing rows now flagged as deleted)
    const toDelete = tiers
      .filter(t => t._deleted && t.id && originalIds.has(t.id))
      .map(t => t.id as string);

    // Upsert payload
    const toUpsert = tiers.filter(t => !t._deleted).map(t => ({
      ...(t.id ? { id: t.id } : {}),
      courier_id: courierId,
      min_weight: Number(t.min_weight),
      max_weight: Number(t.max_weight),
      base_price: Number(t.base_price),
      extra_kg_price: Number(t.extra_kg_price),
    }));

    if (toDelete.length) {
      const { error } = await supabase
        .from("courier_pricing_tiers" as any)
        .delete()
        .in("id", toDelete);
      if (error) { setSaving(false); toast.error(error.message); return; }
    }

    if (toUpsert.length) {
      const { error } = await supabase
        .from("courier_pricing_tiers" as any)
        .upsert(toUpsert, { onConflict: "id" });
      if (error) { setSaving(false); toast.error(error.message); return; }
    }

    setSaving(false);
    toast.success("تم حفظ شرائح التسعير");
    load();
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
      </div>
    );
  }

  const visible = tiers.map((t, i) => ({ t, i })).filter(({ t }) => !t._deleted);

  return (
    <Card className="p-4 space-y-3" dir="rtl">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" /> شرائح التسعير حسب الوزن (هجين)
        </h4>
        <Button size="sm" variant="outline" onClick={addTier} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> إضافة شريحة
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        كل شريحة لها وزن أدنى وأقصى وسعر أساس. سعر الكيلو الإضافي يُطبّق على الوزن الذي يتجاوز الحد الأقصى للشريحة.
      </p>

      {visible.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-md">
          لم تُضف أي شريحة بعد — اضغط "إضافة شريحة" للبدء.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-[11px] text-muted-foreground px-1">
            <div className="col-span-2">الوزن من (كغ)</div>
            <div className="col-span-2">الوزن إلى (كغ)</div>
            <div className="col-span-3">السعر الأساس (ل.س)</div>
            <div className="col-span-4">سعر الكيلو الإضافي (ل.س)</div>
            <div className="col-span-1"></div>
          </div>
          {visible.map(({ t, i }) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <Input
                className="col-span-2"
                type="number"
                min="0"
                step="0.1"
                value={t.min_weight}
                onChange={(e) => updateTier(i, "min_weight", e.target.value)}
              />
              <Input
                className="col-span-2"
                type="number"
                min="0"
                step="0.1"
                value={t.max_weight}
                onChange={(e) => updateTier(i, "max_weight", e.target.value)}
              />
              <Input
                className="col-span-3"
                type="number"
                min="0"
                step="100"
                value={t.base_price}
                onChange={(e) => updateTier(i, "base_price", e.target.value)}
              />
              <Input
                className="col-span-4"
                type="number"
                min="0"
                step="100"
                value={t.extra_kg_price}
                onChange={(e) => updateTier(i, "extra_kg_price", e.target.value)}
              />
              <Button
                size="icon"
                variant="ghost"
                className="col-span-1 text-destructive"
                onClick={() => removeTier(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          حفظ الشرائح
        </Button>
      </div>
    </Card>
  );
}