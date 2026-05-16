import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { fmtSYP } from "./types";

interface Props { balance: number; earningsMonth: number; }

export function WalletCard({ balance, earningsMonth }: Props) {
  return (
    <Card className="border-primary/30 bg-card">
      <CardContent className="p-5 md:p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">رصيد المحفظة</div>
            <div className="text-3xl font-bold tracking-tight">{fmtSYP(balance)}</div>
          </div>
          <span className="p-3 rounded-xl bg-primary/15 text-primary">
            <Wallet className="h-5 w-5" />
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-border/50 pt-3">
          <div className="text-xs text-muted-foreground">
            أرباح الشهر: <span className="text-foreground font-semibold">{fmtSYP(earningsMonth)}</span>
          </div>
          <Button asChild size="sm" variant="ghost" className="h-8">
            <Link to="/courier/wallet" className="flex items-center gap-1">
              التفاصيل <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}