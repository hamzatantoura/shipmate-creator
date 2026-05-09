import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import StarRating from "@/shared/components/inputs/StarRating";

type Ctx = {
  order_id: string;
  sila_code: string;
  receiver_name: string | null;
  product_name: string | null;
  courier_name: string | null;
  already_reviewed: boolean;
};

export default function ReviewOrderPage() {
  const { order_id } = useParams<{ order_id: string }>();
  const [loading, setLoading] = useState(true);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!order_id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_review_context" as any, {
        p_order_id: order_id,
      });
      setLoading(false);
      if (error) {
        setError("تعذر تحميل بيانات الطلب");
        return;
      }
      const r = data as any;
      if (r?.error === "not_found") setError("الطلب غير موجود");
      else if (r?.error === "not_eligible") setError("لا يمكن تقييم هذا الطلب بعد");
      else setCtx(r as Ctx);
    })();
  }, [order_id]);

  const submit = async () => {
    if (!order_id) return;
    if (comment.length > 1000) {
      toast.error("التعليق طويل جداً");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("submit_order_review" as any, {
      p_order_id: order_id,
      p_rating: rating,
      p_comment: comment.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "تعذر إرسال التقييم");
      return;
    }
    toast.success("شكراً لتقييمك ❤️");
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-lg bg-card border-border">
        <CardHeader>
          <CardTitle className="text-center text-xl font-display">
            تقييم تجربتك مع صلة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">جارٍ التحميل...</p>
          ) : error ? (
            <div className="text-center py-8 space-y-3">
              <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
              <p className="text-destructive">{error}</p>
              <Button asChild variant="outline">
                <Link to="/">العودة للرئيسية</Link>
              </Button>
            </div>
          ) : done || ctx?.already_reviewed ? (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <p className="text-foreground font-medium">
                {done ? "تم تسجيل تقييمك بنجاح" : "تم تقييم هذا الطلب مسبقاً"}
              </p>
              <p className="text-sm text-muted-foreground">شكراً لاختيارك صلة 🙏</p>
            </div>
          ) : ctx ? (
            <>
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">
                  مرحباً {ctx.receiver_name || "عميلنا الكريم"}
                </p>
                <p className="text-base text-foreground">
                  طلب رقم{" "}
                  <span className="font-mono font-semibold text-primary">{ctx.sila_code}</span>
                </p>
                {ctx.product_name && (
                  <p className="text-sm text-muted-foreground">{ctx.product_name}</p>
                )}
                {ctx.courier_name && (
                  <p className="text-xs text-muted-foreground">
                    شركة الشحن: {ctx.courier_name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm text-foreground text-center">كيف كانت تجربتك؟</p>
                <div className="flex justify-center">
                  <StarRating value={rating} onChange={setRating} size={36} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-foreground">تعليقك (اختياري)</label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 1000))}
                  placeholder="شاركنا رأيك بالخدمة..."
                  rows={4}
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground text-left">
                  {comment.length}/1000
                </p>
              </div>

              <Button
                onClick={submit}
                disabled={submitting}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {submitting ? "جارٍ الإرسال..." : "إرسال التقييم"}
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
