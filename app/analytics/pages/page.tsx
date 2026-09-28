import { BreakdownSection } from "../_components/BreakdownSection";

export default function AnalyticsPagesPage() {
  return (
    <BreakdownSection
      title="Pages"
      description="Try Theme clicks and installs by the page they happened on, and by the page the visit started on (landing page)."
      dimensions={["landingPage", "page"]}
    />
  );
}
