import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, TrendingUp, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/use-language";
import { fmtSYP } from "./types";

interface Props { available: number; pending: number; }

export default function WalletOverview({ available, pending }: Props) {
  const { t } = useTranslation("dashboard");
  const { isRtl } = useLanguage();
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
      <Card className="relative overflow-hidden border-emerald-500/30 bg-gradient-to-bl from-emerald-500/10 via-card to-card">
        <div className="absolute -top-8 -left-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
        <CardContent className="pt-6 relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-emerald-600">
              <Wallet className="h-4 w-4" />
              <span className="text-sm font-medium">{t("wallet.available")}</span>
            </div>
            <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
              <Link to="/merchant/wallet" className="flex items-center gap-1">
                {t("wallet.open")} <Arrow className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{fmtSYP(available)}</p>
          <p className="text-xs text-muted-foreground mt-2">{t("wallet.availableDesc")}</p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden border-sky-500/30 bg-gradient-to-bl from-sky-500/10 via-card to-card">
        <div className="absolute -top-8 -left-8 h-32 w-32 rounded-full bg-sky-500/10 blur-2xl" />
        <CardContent className="pt-6 relative">
          <div className="flex items-center gap-2 text-sky-600 mb-3">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-medium">{t("wallet.expected")}</span>
          </div>
          <p className="text-3xl font-bold text-sky-600">{fmtSYP(pending)}</p>
          <p className="text-xs text-muted-foreground mt-2">{t("wallet.expectedDesc")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
