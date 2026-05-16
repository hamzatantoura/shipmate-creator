import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navigation, Radio } from "lucide-react";

export function GpsPlaceholder() {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Navigation className="h-4 w-4 text-primary" /> تتبع GPS
        </CardTitle>
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 gap-1 text-[10px]">
          <Radio className="h-3 w-3" /> قريباً
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="h-[180px] rounded-lg border border-dashed border-border/60 bg-muted/30 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/15 text-primary">
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