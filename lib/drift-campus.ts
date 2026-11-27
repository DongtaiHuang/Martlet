// The Martlet Drift campus loop (ADR 0052): up Sherbrooke, in through the Roddick Gates, up the
// main avenue past the Arts Building, west by Leacock and down McTavish back to Sherbrooke. Built
// once from OpenStreetMap paths and streets (© OpenStreetMap contributors, ODbL), resampled every
// 20 m, starting 40 m up Sherbrooke. Same axes and ORIGIN as lib/drift-streets.ts.

export const CAMPUS_LOOP: [number, number][] = [
  [173.0, 250.6], [184.5, 234.1], [195.8, 217.5], [207.2, 201.0], [218.6, 184.5], [230.1, 168.0],
  [227.2, 154.0], [210.8, 142.4], [194.3, 130.8], [177.9, 119.3], [161.5, 107.7], [145.1, 96.1],
  [128.7, 84.6], [112.2, 73.0], [95.8, 61.4], [79.5, 49.7], [63.1, 38.1], [46.8, 26.4],
  [29.1, 18.3], [9.9, 21.3], [-1.9, 37.3], [-13.2, 53.9], [-24.6, 70.4], [-39.7, 80.3],
  [-52.4, 86.2], [-52.2, 106.2], [-52.0, 126.3], [-47.0, 145.2], [-30.6, 156.7], [-14.2, 168.2],
  [2.2, 179.8], [18.7, 191.4], [35.2, 202.8], [51.8, 214.1], [68.4, 225.4], [84.9, 236.8],
  [101.2, 248.5], [117.5, 260.3], [133.8, 272.0], [150.2, 283.6], [161.6, 267.1],
];

/** The sign shown on each stretch of the loop. */
export const CAMPUS_SIGNS = ["Rue Sherbrooke O.", "Roddick Gates", "Arts Building", "Leacock Building", "Rue McTavish"] as const;
export const CAMPUS_SIGN_OF_POINT: number[] = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0];
