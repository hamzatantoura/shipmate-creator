import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Star, MapPin } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";

interface Branch {
  id: string; merchant_id: string;
  name: string; address: string;
  phone: string | null; whatsapp: string | null;
  is_primary: boolean;
}

const empty = { name: "", address: "", phone: "", whatsapp: "", is_primary: false };

export default function MerchantBranchesManager() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState(empty);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("merchant_branches" as any)
      .select("*").eq("merchant_id", user.id)
      .order("is_primary", { ascending: false }).order("created_at");
    if (data) setBranches(data as any);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({ name: b.name, address: b.address, phone: b.phone || "", whatsapp: b.whatsapp || "", is_primary: b.is_primary });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const payload = {
      merchant_id: user.id,
      name: form.name.trim(),
      address: form.address.trim(),
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      is_primary: form.is_primary,
    };
    if (!payload.name || !payload.address) { toast.error("الاسم والعنوان مطلوبان"); return; }

    // Enforce single primary
    if (form.is_primary) {
      await supabase.from("merchant_branches" as any)
        .update({ is_primary: false } as any).eq("merchant_id", user.id);
    }

    if (editing) {
      const { error } = await supabase.from("merchant_branches" as any).update(payload as any).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("تم تحديث الفرع");
    } else {
      const { error } = await supabase.from("merchant_branches" as any).insert(payload as any);
      if (error) { toast.error(error.message); return; }
      toast.success("تم إضافة الفرع");
    }
    setOpen(false); refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا الفرع؟")) return;
    const { error } = await supabase.from("merchant_branches" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم الحذف"); refresh(); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">الفروع</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" /> إضافة فرع
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "تعديل الفرع" : "فرع جديد"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div className="space-y-1.5">
                <Label>اسم الفرع</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="الفرع الرئيسي" required />
              </div>
              <div className="space-y-1.5">
                <Label>العنوان</Label>
                <Textarea rows={2} value={form.address} onChange={e => setForm({...form, address: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>الهاتف</Label>
                  <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="09xxxxxxxx" />
                </div>
                <div className="space-y-1.5">
                  <Label>واتساب</Label>
                  <Input value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} placeholder="9639xxxxxxxx" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <Label className="text-sm">فرع رئيسي</Label>
                <Switch checked={form.is_primary} onCheckedChange={(v) => setForm({...form, is_primary: v})} />
              </div>
              <Button type="submit" className="w-full">{editing ? "حفظ" : "إضافة"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {branches.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
            لم تُضف أي فرع بعد.
          </div>
        ) : (
          <ul className="space-y-2">
            {branches.map(b => (
              <li key={b.id} className="rounded-lg border border-border bg-card/40 p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">{b.name}</span>
                    {b.is_primary && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{b.address}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex gap-3">
                    {b.phone && <span>{b.phone}</span>}
                    {b.whatsapp && <span>واتساب: {b.whatsapp}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(b)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(b.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}