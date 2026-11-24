// How a team member's average review is scored (owner, 2026-11-24: "while putting ratings on a team member consider a project with no
// rating as 3.5 stars, give more weightage to five stars on the positive side and more weightage to projects with 1 and 2 stars in a
// negative way"). Each project counts for the member's hours on it, times a weight that depends on its stars: the weight is 1 for
// 3 and 4 stars (and for the 3.5 of an unrated project), 2 for 5 stars, 2 for 2 stars and 3 for 1 star, in a straight line between
// those points, so 4.4 stars weighs 1.4. The score stays between 1 and 5. It is used for people only: a client's or the portfolio's
// average review is still the plain average of the rated projects.
export const UNRATED_STARS = 3.5;

const KNOTS: ReadonlyArray<readonly [number, number]> = [
  [1, 3],
  [2, 2],
  [3, 1],
  [4, 1],
  [5, 2],
];

/** Weight of a project of `stars` stars (1 to 5). */
export function ratingWeight(stars: number): number {
  const s = Math.min(5, Math.max(1, stars));
  for (let i = 1; i < KNOTS.length; i++) {
    const [x0, w0] = KNOTS[i - 1]!;
    const [x1, w1] = KNOTS[i]!;
    if (s <= x1) return w0 + ((w1 - w0) * (s - x0)) / (x1 - x0);
  }
  return KNOTS[KNOTS.length - 1]![1];
}

/** The member's score: hours x weight weighted mean of each project's stars (unrated = 3.5); null when there are no hours. */
export function memberRating(projects: ReadonlyArray<{ rating: number | null; minutes: number }>): number | null {
  let sum = 0;
  let weight = 0;
  for (const p of projects) {
    if (p.minutes <= 0) continue;
    const stars = p.rating ?? UNRATED_STARS;
    const w = ratingWeight(stars) * p.minutes;
    sum += stars * w;
    weight += w;
  }
  return weight ? sum / weight : null;
}
