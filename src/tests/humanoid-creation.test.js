import test from "node:test";
import assert from "node:assert/strict";
import {
  createCreationUrl,
  decodeCreationRecipe,
  DEFAULT_CREATION,
  encodeCreationRecipe,
  MAX_CREATION_COMPONENTS,
  MAX_ENCODED_CREATION_LENGTH,
  MAX_CREATION_URL_LENGTH,
  readCreationFromUrl,
  validateCreationRecipe
} from "../humanoid-creation.js";

const exampleCreation = {
  version: 1,
  pose: "arms-crossed",
  components: [
    { id: "horn-crystal", anchor: "head", offset: [0.14, 0.3, -0.22], rotation: [0, 0, 0, 1] },
    { id: "wings", anchor: "torso", offset: [-0.48, 0.12, -0.65], rotation: [0, 0.707107, 0, 0.707107] },
    { id: "tail", anchor: "hips", offset: [0.2, -0.45, -0.3], rotation: [0.5, 0, 0, 0.866025] }
  ]
};

test("creation recipes round-trip in compact URL-safe form", () => {
  const encoded = encodeCreationRecipe(exampleCreation);
  const restored = decodeCreationRecipe(encoded);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/u);
  assert.equal(restored.version, 1);
  assert.equal(restored.pose, "arms-crossed");
  assert.equal(restored.components.length, 3);
  assert.equal(restored.components[1].id, "wings");
  assert.equal(restored.components[1].anchor, "torso");
  assert.deepEqual(restored.components[0].offset, exampleCreation.components[0].offset);
});

test("local image data never enters the shareable recipe", () => {
  const withLocalImage = {
    ...exampleCreation,
    imageBadges: [{ filename: "private.png", data: "data:image/png;base64,private-image-bytes" }]
  };
  const restored = decodeCreationRecipe(encodeCreationRecipe(withLocalImage));
  assert.equal("imageBadges" in restored, false);
  assert.equal(JSON.stringify(restored).includes("private-image-bytes"), false);
});

test("creation links include the humanoid route and restore the recipe", () => {
  const url = createCreationUrl(exampleCreation, "https://example.test/workshop?source=campus");
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("scene"), null);
  assert.equal(parsed.searchParams.get("source"), "campus");
  assert.deepEqual(readCreationFromUrl(url).recipe, validateCreationRecipe(exampleCreation));
  assert.equal(readCreationFromUrl("https://example.test/").shared, false);
  assert.throws(() => createCreationUrl(exampleCreation, `https://example.test/?x=${"a".repeat(MAX_CREATION_URL_LENGTH)}`), /length limit/);
});

test("invalid or unsupported shared data falls back to the default recipe", () => {
  for (const encoded of ["", "not-valid!*", "eyJ2Ijo5LCJwIjoiaWRsZSIsImMiOltdfQ"]) {
    const result = readCreationFromUrl(`https://example.test/?creation=${encoded}`);
    assert.equal(result.valid, false);
    assert.deepEqual(result.recipe, DEFAULT_CREATION);
  }
  assert.throws(() => decodeCreationRecipe("x".repeat(MAX_ENCODED_CREATION_LENGTH + 1)), /too large/);
});

test("recipe validation rejects unknown components, anchors, poses, and out-of-range transforms", () => {
  const invalidCases = [
    { ...exampleCreation, components: [{ ...exampleCreation.components[0], id: "remote-model" }] },
    { ...exampleCreation, components: [{ ...exampleCreation.components[0], anchor: "wrist" }] },
    { ...exampleCreation, pose: "dance" },
    { ...exampleCreation, components: [{ ...exampleCreation.components[0], offset: [0, 0, 8] }] },
    { ...exampleCreation, components: [{ ...exampleCreation.components[0], rotation: [2, 0, 0, 0] }] },
    { ...exampleCreation, version: 2 },
    { ...exampleCreation, components: Array.from({ length: MAX_CREATION_COMPONENTS + 1 }, () => exampleCreation.components[0]) }
  ];
  invalidCases.forEach(recipe => assert.throws(() => validateCreationRecipe(recipe)));
});

test("URL state handles malformed encoding without throwing", () => {
  const result = readCreationFromUrl("https://example.test/?creation=%25");
  assert.equal(result.valid, false);
  assert.deepEqual(result.recipe, DEFAULT_CREATION);
});
