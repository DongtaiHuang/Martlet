import assert from "node:assert/strict";
import test from "node:test";
import { buildTrack, nearest, onTrack, startingCar } from "../lib/drift.ts";
import { lngLatToWorld, worldToLngLat } from "../lib/drift-map.ts";
import { STREET_LOOP } from "../lib/drift-streets.ts";

const track = buildTrack(STREET_LOOP);

test("world and map coordinates convert both ways", () => {
  for (const [x, z] of [[0, 0], [150, -80], [-220, 300]]) {
    const { lng, lat } = worldToLngLat(x, z);
    const back = lngLatToWorld(lng, lat);
    assert.ok(Math.abs(back.x - x) < 1e-6 && Math.abs(back.z - z) < 1e-6);
  }
  // North is -z, east is +x.
  const a = worldToLngLat(0, 0), north = worldToLngLat(0, -100), east = worldToLngLat(100, 0);
  assert.ok(north.lat > a.lat && east.lng > a.lng);
});

test("the loop follows the real junctions (within a few metres)", () => {
  const junctions = {
    "Sherbrooke & University": [-73.573477, 45.504975],
    "University & Pine": [-73.580116, 45.508203],
    "Pine & McTavish": [-73.581191, 45.505311],
  };
  for (const [name, [lng, lat]] of Object.entries(junctions)) {
    const { x, z } = lngLatToWorld(lng, lat);
    // The resampled, smoothed corner cuts a little inside the junction.
    assert.ok(nearest(track, x, z).distance < 15, `${name}: ${nearest(track, x, z).distance.toFixed(1)} m`);
  }
  assert.ok(track.length > 1650 && track.length < 1850, `length ${track.length}`);
});

test("the car starts on the track, pointing up Sherbrooke (north-east)", () => {
  const car = startingCar(track);
  assert.ok(onTrack(track, car.x, car.z));
  // Heading 0 faces +z (south); north-east in these axes is x > 0, z < 0.
  assert.ok(Math.sin(car.heading) > 0.3 && Math.cos(car.heading) < -0.3, `heading ${car.heading}`);
});
