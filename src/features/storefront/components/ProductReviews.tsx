import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import StarRating from "@/shared/components/inputs/StarRating";

interface Props {
  productId: string;
}

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export default function ProductReviews({ productId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["product-reviews", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews" as any)
        .select("id, rating, comment, created_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as Review[];
    },
    staleTime: 60_000,
  });

  if (isLoading) return null;
  if (!data || data.length === 0) return null;

  const avg = data.reduce((s, r) => s + r.rating, 0) / data.length;

  return (
    <Card className="border-border bg-card mt-6">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> آراء العملاء
          </h3>
          <div className="flex items-center gap-2">
            <StarRating value={avg} readOnly size={18} />
            <span className="text-sm text-muted-foreground">
              {avg.toFixed(1)} ({data.length})
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {data.slice(0, 6).map((r) => (
            <div key={r.id} className="rounded-lg border border-border/60 p-3 bg-background/40">
              <div className="flex items-center justify-between mb-1">
                <StarRating value={r.rating} readOnly size={14} />
                <span className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("ar-SY")}
                </span>
              </div>
              {r.comment && (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {r.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
