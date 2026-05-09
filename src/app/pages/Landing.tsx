import { LandingNav } from "@/features/landing/components/LandingNav";
import { Hero } from "@/features/landing/components/Hero";
import { TrustedBy } from "@/features/landing/components/TrustedBy";
import { Features } from "@/features/landing/components/Features";
import { DashboardPreviewSection } from "@/features/landing/components/DashboardPreviewSection";
import { Workflow } from "@/features/landing/components/Workflow";
import { Testimonials } from "@/features/landing/components/Testimonials";
import { Faq } from "@/features/landing/components/Faq";
import { CtaBanner } from "@/features/landing/components/CtaBanner";
import { LandingFooter } from "@/features/landing/components/LandingFooter";
import { Seo } from "@/shared/seo/Seo";

export default function Landing() {
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Sila — صلة",
    url: "https://sila-sy.com",
    logo: "https://sila-sy.com/icon-512.png",
    sameAs: [],
    address: { "@type": "PostalAddress", addressLocality: "Damascus", addressCountry: "SY" },
  };

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <Seo
        title="صلة — منصة التجارة والشحن المتكاملة في سوريا"
        description="صلة هي منصة لوجستية متكاملة للتجار وشركات الشحن في سوريا: متجر إلكتروني، تتبع شحنات لحظي، محفظة مالية، وتحليلات ذكية في مكان واحد."
        type="website"
        jsonLd={orgJsonLd}
      />
      <LandingNav />
      <main>
        <Hero />
        <TrustedBy />
        <Features />
        <DashboardPreviewSection />
        <Workflow />
        <Testimonials />
        <Faq />
        <CtaBanner />
      </main>
      <LandingFooter />
    </div>
  );
}
