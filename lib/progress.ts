// Landmark progress -> tree growth stage. Pure functions, safe on server and client.

export const TREE_STAGES = [
  "Seed",
  "Sprout",
  "Sapling",
  "Young tree",
  "Growing tree",
  "Mature tree",
  "Full bloom",
] as const;

export type TreeStage = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const FINAL_STAGE: TreeStage = 6;

/**
 * Seed with nothing unlocked, full bloom only at 100%, and every unlock in between
 * contributes toward the next growth stage.
 */
export function treeStage(unlocked: number, total: number): TreeStage {
  if (total <= 0 || unlocked <= 0) return 0;
  if (unlocked >= total) return FINAL_STAGE;
  return Math.min(5, Math.max(1, Math.round((unlocked / total) * FINAL_STAGE))) as TreeStage;
}

/** How many more unlocks until the tree reaches its next stage, or null when fully grown. */
export function unlocksToNextStage(unlocked: number, total: number): number | null {
  const current = treeStage(unlocked, total);
  for (let next = unlocked + 1; next <= total; next++) {
    if (treeStage(next, total) > current) return next - unlocked;
  }
  return null;
}
