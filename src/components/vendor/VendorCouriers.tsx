import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus, Phone, User, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Courier {
  id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
  vendor_id: string;
  created_at: string;
}

export default function VendorCouriers() {
  const { user } = useAuth();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("couriers")
      .select("*")
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setCouriers(data as Courier[]);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [user]);

  const addCourier = async () => {
    if (!name.trim() || !user) return;
    setSaving(true);
    const { error } = await supabase.from("couriers").insert({
      name: name.trim(),
      phone: phone.trim() || null,
      vendor_id: user.id,
    } as any);
    if (error) {
      toast.error("فشلت الإضافة");
    } else {
      toast.success("تمت إضافة المندوب");
      setName(""); setPhone(""); setOpen(false);
      fetch();
    }
    setSaving(false);
  };

  const toggleActive = async (c: Courier) => {
    await supabase.from("couriers").update({ is_active: !c.is_active } as any).eq("id", c.id);
    fetch();
  };

  const deleteCourier = async (id: string) => {
    await supabase.from("couriers").delete().eq("id", id);
    toast.success("تم حذف المندوب");
    fetch();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-lg text-foreground">إدارة المناديب</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="glow-btn gap-1.5">
              <UserPlus className="h-4 w-4" /> إضافة مندوب
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">إضافة مندوب جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>الاسم الكامل</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: أحمد محمد" className="mt-1" />
              </div>
              <div>
                <Label>رقم الهاتف</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="09XXXXXXXX" className="mt-1" dir="ltr" />
              </div>
              <Button onClick={addCourier} disabled={!name.trim() || saving} className="w-full glow-btn">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ المندوب"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {couriers.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <User className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">لم تضف أي مناديب بعد</p>
            <p className="text-xs text-muted-foreground mt-1">أضف مناديبك لتعيين الشحنات لهم من خريطة العمليات</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {couriers.map(c => (
            <Card key={c.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{c.name}</p>
                      {c.phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5" dir="ltr">
                          <Phone className="h-3 w-3" /> {c.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={c.is_active
                      ? "bg-primary/10 text-primary border-primary/30 cursor-pointer"
                      : "bg-muted text-muted-foreground cursor-pointer"
                    }
                    onClick={() => toggleActive(c)}
                  >
                    {c.is_active ? "نشط" : "معطّل"}
                  </Badge>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteCourier(c.id)}>
                    <Trash2 className="h-3.5 w-3.5 ml-1" /> حذف
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
