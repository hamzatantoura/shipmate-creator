import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/use-language";

interface Item { q: string; a: string; }

export function Faq() {
  const { t } = useTranslation("landing");
  const { isRtl } = useLanguage();
  const items = t("faq.items", { returnObjects: true }) as Item[];

  return (
    <section id="faq" className="py-20 sm:py-28">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">{t("faq.eyebrow")}</p>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground tracking-tight">
            {t("faq.title")}
          </h2>
        </div>
        <Accordion type="single" collapsible className="space-y-3">
          {items.map((item, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="border border-border/60 rounded-xl bg-card/60 backdrop-blur-sm px-5 data-[state=open]:border-primary/30 data-[state=open]:shadow-md transition"
            >
              <AccordionTrigger className={`${isRtl ? "text-right" : "text-left"} text-base font-display font-semibold py-4 hover:no-underline`}>
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
