import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navigation, Radio } from "lucide-react";

export function GpsPlaceholder() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Navigation className="h-4 w-4 text-primary" /> تتبع GPS
        </CardTitle>
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 gap-1 text-[10px]">
          <Radio className="h-3 w-3" /> قريباً
        </Badge>
      </CardHeader>
      <CardContent>
        <div
          className="relative h-[180px] rounded-lg border border-dashed border-border/60 bg-muted/30 overflow-hidden flex items-center justify-center"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 40%, hsl(var(--primary)/0.08), transparent 60%), radial-gradient(circle at 70% 60%, hsl(var(--info)/0.08), transparent 60%)",
          }}
        >
          <div className="absolute inset-0 opacity-40" style={{
            backgroundImage: "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }} />
          <div className="relative text-center space-y-2">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/15 text-primary animate-pulse">
              <Navigation className="h-5 w-5" />
            </div>
            <div className="text-sm font-semibold">خريطة التتبع المباشر</div>
            <div className="text-[11px] text-muted-foreground max-w-[260px] mx-auto">
              سيتم عرض مواقع المندوبين والشحنات لحظياً عند تفعيل خدمة GPS.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}