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

// ---- Tree species (issue #133, ADR 0030) -----------------------------------------------------

export const TREE_SPECIES = ["classic", "sakura", "maple", "pine", "willow", "sequoia"] as const;
export type TreeSpecies = (typeof TREE_SPECIES)[number];
export const DEFAULT_SPECIES: TreeSpecies = "classic";
/** Cookie holding the chosen species, so the server can draw the right tree. */
export const SPECIES_COOKIE = "martlet.tree";

export const SPECIES_INFO: Record<TreeSpecies, { label: string; description: string }> = {
  classic: { label: "Classic", description: "A round, leafy campus tree" },
  sakura: { label: "Sakura", description: "A wide cherry tree in pink" },
  maple: { label: "Maple", description: "Dense autumn reds and golds" },
  pine: { label: "Pine", description: "Tall evergreen tiers with cones" },
  willow: { label: "Willow", description: "Long strands that sway" },
  sequoia: { label: "Sequoia", description: "A towering red trunk" },
};

export function parseSpecies(value: unknown): TreeSpecies {
  return typeof value === "string" && (TREE_SPECIES as readonly string[]).includes(value) ? (value as TreeSpecies) : DEFAULT_SPECIES;
}

// ---- Levels after full bloom ----------------------------------------------------------------
// Full bloom still needs every landmark (above). After that the tree keeps growing with
// meetups hosted + joined, so it stays worth visiting.

export const BLOOM_LEVELS = ["Full bloom", "Songbird tree", "Wildflower meadow", "Ancient tree"] as const;
export type BloomLevel = 0 | 1 | 2 | 3;
/** Meetups (hosted + joined) needed for each level after full bloom. */
export const BLOOM_THRESHOLDS = [0, 3, 10, 25] as const;

export function bloomLevel(meetups: number): BloomLevel {
  let level: BloomLevel = 0;
  for (let i = 1; i < BLOOM_THRESHOLDS.length; i++) if (meetups >= BLOOM_THRESHOLDS[i]) level = i as BloomLevel;
  return level;
}

/** Meetups still needed for the next level after full bloom, or null at the top level. */
export function meetupsToNextBloom(meetups: number): number | null {
  const next = BLOOM_THRESHOLDS[bloomLevel(meetups) + 1];
  return next === undefined ? null : next - Math.max(0, meetups);
}
