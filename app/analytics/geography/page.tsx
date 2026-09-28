import { BreakdownSection } from "../_components/BreakdownSection";

export default function AnalyticsGeographyPage() {
  return (
    <BreakdownSection
      title="Geography"
      description="Try Theme clicks and installs by country."
      dimensions={["country"]}
      byTheme
    />
  );
}
