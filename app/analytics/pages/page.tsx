import { BreakdownSection } from "../_components/BreakdownSection";

export default function AnalyticsPagesPage() {
  return (
    <BreakdownSection
      title="Pages"
      description="Landing page is where a session started; page is any page viewed. Users per page overlap, since one person views many pages."
      dimensions={["landingPage", "page"]}
    />
  );
}
