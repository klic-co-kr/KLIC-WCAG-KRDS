import { Benefits } from "./benefits";
import { FaqSection, CtaBand, SiteFooter } from "./faq-footer";
import { Features } from "./features";
import { Header } from "./header";
import { Hero } from "./hero";
import { Process } from "./process";
import { ReportSection } from "./report-section";

export function LandingPage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <Header />
      <main className="flex-1">
        <Hero />
        <Features />
        <ReportSection />
        <Process />
        <Benefits />
        <FaqSection />
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  );
}
