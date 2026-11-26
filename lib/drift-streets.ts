// The real-street Martlet Drift loop (ADR 0047): Sherbrooke (McTavish to University), up
// University to Pine, down Pine to McTavish, and down McTavish back to Sherbrooke. Generated once
// from OpenStreetMap street geometry (© OpenStreetMap contributors, ODbL) and resampled every
// 30 m. Game axes: x east, z south, in metres from ORIGIN. The first point is 90 m up
// Sherbrooke from McTavish, on the straight, so the car starts pointing along the street.

/** The map point at the game's (0, 0). */
export const ORIGIN = { lng: -73.577680, lat: 45.505210 } as const;

export const STREET_LOOP: [number, number][] = [
  [201.1, 209.8], [218.1, 185.2], [235.1, 160.6], [252.0, 136.0], [269.0, 111.4], [286.0, 86.8],
  [302.9, 62.2], [319.8, 37.5], [314.9, 17.0], [290.1, 0.2], [265.4, -16.5], [240.7, -33.3],
  [216.2, -50.5], [191.7, -67.6], [167.2, -84.7], [142.7, -101.9], [118.2, -119.0], [93.7, -136.1],
  [69.1, -153.0], [44.4, -169.9], [19.8, -186.8], [-4.9, -203.8], [-29.5, -220.7], [-54.2, -237.6],
  [-78.7, -254.6], [-103.2, -271.8], [-127.7, -288.9], [-152.1, -306.1], [-176.3, -323.7], [-193.8, -320.7],
  [-201.7, -291.8], [-209.5, -263.0], [-217.1, -234.1], [-224.4, -205.1], [-231.6, -176.1], [-238.8, -147.1],
  [-246.1, -118.1], [-253.5, -89.1], [-260.9, -60.2], [-268.2, -31.2], [-266.1, -6.6], [-241.7, 10.6],
  [-217.2, 27.8], [-192.8, 45.0], [-168.4, 62.3], [-143.8, 79.3], [-119.3, 96.4], [-94.5, 113.1],
  [-69.2, 128.9], [-45.5, 146.2], [-21.0, 163.4], [3.4, 180.6], [27.9, 197.8], [52.6, 214.6],
  [77.2, 231.5], [101.6, 248.8], [125.9, 266.2], [150.2, 283.6], [167.1, 259.0], [184.2, 234.4],
];
