import assert from "node:assert/strict";
import test from "node:test";
import { bloomLevel, meetupsToNextBloom, parseSpecies, TREE_SPECIES, treeStage } from "../lib/progress.ts";
import { pixelScene, treeColors } from "../components/progress/pixel-tree.ts";

test("levels after full bloom follow meetups (3 / 10 / 25)", () => {
  assert.deepEqual([0, 2, 3, 9, 10, 24, 25, 400].map(bloomLevel), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.deepEqual([0, 2, 3, 24, 25].map(meetupsToNextBloom), [3, 1, 7, 1, null]);
});

test("full bloom still needs every landmark", () => {
  assert.equal(treeStage(5, 6), 5);
  assert.equal(treeStage(6, 6), 6);
});

test("unknown species fall back to classic", () => {
  assert.equal(parseSpecies("sakura"), "sakura");
  for (const bad of [undefined, null, "", "oak", 7, "SAKURA"]) assert.equal(parseSpecies(bad), "classic");
});

const size = (scene) => [scene.landscape, scene.wood, scene.foliage, scene.fruit, scene.bird ?? []].flat().reduce((n, p) => n + p.d.length, 0);

test("every species draws every stage, deterministically and within budget", () => {
  for (const species of TREE_SPECIES) {
    for (let stage = 0; stage <= 6; stage++) {
      const scene = pixelScene(stage, 0, species, 0);
      assert.ok(scene.foliage.length > 0, `${species} ${stage} has leaves`);
      if (stage >= 3) assert.ok(scene.wood.length > 0, `${species} ${stage} has a trunk`);
      assert.ok(size(scene) < 40_000, `${species} ${stage} is ${size(scene)} chars`);
    }
    const a = JSON.stringify(pixelScene(6, 3, species, 3)), b = JSON.stringify(pixelScene(6, 3, species, 3));
    assert.equal(a, b);
  }
});

test("six photo fruits fit on every full-grown species", () => {
  for (const species of TREE_SPECIES) assert.equal(pixelScene(6, 6, species).fruitSpots.length, 6, species);
});

test("bloom levels add birds and only apply at full bloom", () => {
  const birds = (scene) => (scene.bird?.[0]?.d.match(/M/g) ?? []).length;
  const b0 = birds(pixelScene(6, 0, "classic", 0)), b1 = birds(pixelScene(6, 0, "classic", 1)), b3 = birds(pixelScene(6, 0, "classic", 3));
  assert.ok(b0 < b1 && b1 < b3, `${b0} < ${b1} < ${b3}`);
  assert.equal(pixelScene(5, 0, "classic", 3).bird, null);
  assert.notEqual(JSON.stringify(pixelScene(6, 0, "classic", 2).landscape), JSON.stringify(pixelScene(6, 0, "classic", 0).landscape), "wildflowers");
});

test("species have their own colours; photo fruit stays red", () => {
  assert.notEqual(treeColors("color", "sakura").leaf2, treeColors("color", "classic").leaf2);
  for (const s of TREE_SPECIES) assert.equal(treeColors("color", s).fruit, "#d62828");
  assert.equal(treeColors("bw", "sakura").leaf2, treeColors("bw", "classic").leaf2);
});
