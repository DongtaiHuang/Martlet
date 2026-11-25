import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTrack, CAMPUS_LOOP, driftAngle, finalScore, MAX_POINTS_PER_SECOND, nearest, newScore, onTrack,
  scoreStep, speedOf, startingCar, step, TRACK_WIDTH,
} from "../lib/drift.ts";

const DT = 1 / 120;
const run = (car, input, seconds, track = true) => {
  for (let t = 0; t < seconds; t += DT) car = step(car, input, DT, track);
  return car;
};
const still = { x: 0, z: 0, heading: 0, vx: 0, vz: 0, yawRate: 0, steer: 0 };
const none = { throttle: 0, brake: 0, steer: 0, handbrake: false };

test("throttle accelerates forward, toward the top speed but not past it", () => {
  const car = run(still, { ...none, throttle: 1 }, 30);
  assert.ok(car.z > 500 && Math.abs(car.x) < 1e-6, "drove straight ahead");
  assert.ok(speedOf(car) > 35 && speedOf(car) <= 46, `speed ${speedOf(car)}`);
});

test("brakes stop the car, then reverse slowly; grass slows it", () => {
  const fast = run(still, { ...none, throttle: 1 }, 6);
  assert.ok(speedOf(run(fast, { ...none, brake: 1 }, 1.5)) < 2, "stopped");
  const back = run(fast, { ...none, brake: 1 }, 4);
  assert.ok(back.vz < 0 && speedOf(back) <= 8.01, "reversing, capped at 8 m/s");
  assert.ok(speedOf(run(fast, none, 2, false)) < speedOf(run(fast, none, 2, true)) * 0.5);
});

test("normal cornering grips; the handbrake breaks traction into a drift", () => {
  const fast = run(still, { ...none, throttle: 1 }, 5);
  const grip = run(fast, { ...none, throttle: 0.6, steer: 0.5 }, 1);
  assert.ok(driftAngle(grip) < 12, `grip angle ${driftAngle(grip)}`);
  let drift = run(fast, { ...none, throttle: 1, steer: 1, handbrake: true }, 0.5);
  drift = run(drift, { ...none, throttle: 1, steer: 0.6 }, 0.4);
  assert.ok(driftAngle(drift) > 15, `drift angle ${driftAngle(drift)}`);
});

test("drifting scores, combos multiply, and points bank after a short pause", () => {
  let s = newScore();
  for (let t = 0; t < 3; t += DT) s = scoreStep(s, 40, 25, true, DT);
  assert.ok(s.current > 0 && s.multiplier === 2, `multiplier ${s.multiplier}`);
  const before = s.current;
  for (let t = 0; t < 2; t += DT) s = scoreStep(s, 0, 25, true, DT);
  assert.equal(s.lastEvent, "banked");
  assert.equal(s.total, Math.round(before));
  assert.equal(s.current, 0);
});

test("leaving the track or spinning out loses the combo", () => {
  let s = newScore();
  for (let t = 0; t < 1; t += DT) s = scoreStep(s, 40, 25, true, DT);
  assert.equal(scoreStep(s, 40, 25, false, DT).lastEvent, "lost");
  assert.equal(scoreStep(s, 150, 20, true, DT).lastEvent, "spun");
  assert.equal(finalScore(scoreStep(s, 40, 25, false, DT)), 0);
});

test("no way to score faster than the server's cap", () => {
  let s = newScore();
  for (let t = 0; t < 30; t += DT) s = scoreStep(s, 60, 999, true, DT);
  assert.ok(finalScore(s) <= MAX_POINTS_PER_SECOND * 30);
});

test("the campus loop is a closed track the car starts on", () => {
  const track = buildTrack(CAMPUS_LOOP);
  assert.ok(track.length > 1000 && track.length < 1400, `length ${track.length}`);
  const car = startingCar(track);
  assert.ok(onTrack(track, car.x, car.z));
  assert.ok(!onTrack(track, car.x + TRACK_WIDTH, car.z), "a track-width sideways is grass");
  assert.ok([199, 200].includes(nearest(track, track.points[200].x, track.points[200].z).index), "nearest point found");
});

test("a held power-slide keeps its pace and angle without beating top speed", () => {
  let car = run(still, { ...none, throttle: 1 }, 5);
  car = run(car, { ...none, throttle: 1, steer: 1, handbrake: true }, 0.4);
  for (let i = 0; i < 8; i++) {
    car = run(car, { ...none, throttle: 1, steer: 0.35 }, 0.25);
    assert.ok(speedOf(car) > 20 && speedOf(car) < 40, `speed ${speedOf(car)} at ${(i + 1) * 0.25}s`);
    assert.ok(driftAngle(car) >= 15, `angle ${driftAngle(car)} at ${(i + 1) * 0.25}s`);
  }
});
