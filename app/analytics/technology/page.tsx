import { BreakdownSection } from "../_components/BreakdownSection";

export default function AnalyticsTechnologyPage() {
  return (
    <BreakdownSection
      title="Technology"
      description="Desktop, mobile and tablet, plus browser and operating system."
      dimensions={["device", "browser", "os"]}
    />
  );
}
