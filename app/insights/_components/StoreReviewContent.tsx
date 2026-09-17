import { RequirementsReview } from "./RequirementsReview";

export function StoreReviewContent() {
  return (
    <RequirementsReview
      scope="store"
      title="Store Review"
      description="Requirements only checkable by visiting a real, running demo store URL — real rendered contrast, focus behavior, JSON-LD, and page-speed presence. Runs when a demo store URL is supplied at audit time."
    />
  );
}
