import { RequirementsReview } from "./RequirementsReview";

export function CodeReviewContent() {
  return (
    <RequirementsReview
      scope="code"
      title="Code Review"
      description="Every requirement checked by analyzing the theme's own source code — no live store needed. Includes requirements nothing implements yet."
    />
  );
}
