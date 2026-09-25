import { BreakdownSection } from "../_components/BreakdownSection";

// Sorted by installs by default: acquisition is about which traffic brings
// Try Theme clicks and installations, not just visits.
export default function AnalyticsAcquisitionPage() {
  return (
    <BreakdownSection
      title="Acquisition"
      description="Where Try Theme clicks and installs come from: GA4's default channel group, and the session source, medium and campaign."
      dimensions={["channel", "source", "medium", "campaign"]}
      defaultSort="installs"
    />
  );
}
