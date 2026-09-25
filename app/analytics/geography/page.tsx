import { BreakdownSection } from "../_components/BreakdownSection";

export default function AnalyticsGeographyPage() {
  return (
    <BreakdownSection
      title="Geography"
      description="Users, Theme Views, Try Theme and installs by country and city. Filter to a country to see only its cities."
      dimensions={["country", "city"]}
    />
  );
}
