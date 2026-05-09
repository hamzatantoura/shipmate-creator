import { Link } from "react-router-dom";
import silaLogo from "@/assets/sila-logo.png";
import { Mail, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";

export function LandingFooter() {
  const { t } = useTranslation("landing");

  return (
    <footer className="border-t border-border/60 bg-muted/20">
      <div className="max-w-6xl mx-auto px-4 py-14">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img src={silaLogo} alt="Sila" className="h-8 w-8" />
              <span className="font-display font-bold text-xl text-primary">Sila</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              {t("footer.tagline")}
            </p>
          </div>

          <div>
            <h4 className="font-display font-semibold text-foreground mb-3 text-sm">{t("footer.product")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-primary transition-colors">{t("nav.features")}</a></li>
              <li><a href="#workflow" className="hover:text-primary transition-colors">{t("nav.workflow")}</a></li>
              <li><a href="#pricing" className="hover:text-primary transition-colors">{t("nav.pricing")}</a></li>
              <li><Link to="/track" className="hover:text-primary transition-colors">{t("nav.trackShipment")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold text-foreground mb-3 text-sm">{t("footer.account")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/signup" className="hover:text-primary transition-colors">{t("footer.createAccount")}</Link></li>
              <li><Link to="/login" className="hover:text-primary transition-colors">{t("footer.signIn")}</Link></li>
              <li><Link to="/install" className="hover:text-primary transition-colors">{t("footer.downloadApp")}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Sila — {t("footer.rights")}
          </p>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> info@sila-sy.com</span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {t("footer.location")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
