import test from "node:test";
import assert from "node:assert/strict";
import {
  claimReferralBonus,
  consumeImageCredit,
  INITIAL_IMAGE_UPLOAD_CREDITS,
  MAX_IMAGE_FILE_SIZE,
  readImageCredits,
  selectDominantSkinBoneIndex,
  validateImageBadgeTransform,
  validateImageFile
} from "../humanoid-image.js";

test("local image validation allows PNG, JPEG, and WebP within the file-size limit", () => {
  for (const type of ["image/png", "image/jpeg", "image/webp"]) {
    assert.equal(validateImageFile({ type, size: 1024 }), true);
    assert.equal(validateImageFile({ type, size: MAX_IMAGE_FILE_SIZE }), true);
  }
});

test("local image validation rejects unsupported, empty, and oversized files", () => {
  assert.throws(() => validateImageFile({ type: "image/svg+xml", size: 20 }), /Only PNG, JPEG, and WebP/);
  assert.throws(() => validateImageFile({ type: "application/octet-stream", size: 20 }), /Only PNG, JPEG, and WebP/);
  assert.throws(() => validateImageFile({ type: "image/png", size: 0 }), /empty or invalid/);
  assert.throws(() => validateImageFile({ type: "image/webp", size: MAX_IMAGE_FILE_SIZE + 1 }), /5 MB or smaller/);
  assert.throws(() => validateImageFile(null), /Choose a PNG, JPEG, or WebP/);
});

test("browser-local image credits initialize, consume once, and allow one referral claim", () => {
  const values = new Map();
  const storage = {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value))
  };
  assert.equal(readImageCredits(storage), INITIAL_IMAGE_UPLOAD_CREDITS);
  assert.equal(consumeImageCredit(storage), 4);
  const first = claimReferralBonus("student-abc", storage);
  assert.equal(first.claimed, true);
  assert.equal(first.credits, 9);
  assert.equal(claimReferralBonus("student-abc", storage).claimed, false);
});

test("image badge transforms enforce bounded scale and rotation", () => {
  assert.equal(validateImageBadgeTransform(0.5, -180), true);
  assert.equal(validateImageBadgeTransform(3, 180), true);
  assert.throws(() => validateImageBadgeTransform(0.49, 0), /0.5× and 3×/);
  assert.throws(() => validateImageBadgeTransform(1, 181), /-180° and 180°/);
});

test("surface bone selection combines triangle barycentric coordinates and skin weights", () => {
  assert.equal(selectDominantSkinBoneIndex([
    { indices: [0, 1], weights: [0.8, 0.2], barycentric: 0.6 },
    { indices: [0, 1], weights: [0.2, 0.8], barycentric: 0.3 },
    { indices: [1, 2], weights: [0.9, 0.1], barycentric: 0.1 }
  ], 3), 0);
  assert.equal(selectDominantSkinBoneIndex([
    { indices: [0, 1], weights: [1, 0], barycentric: 0.3 },
    { indices: [1, 2], weights: [1, 0], barycentric: 0.5 },
    { indices: [2, 1], weights: [1, 0], barycentric: 0.2 }
  ], 3), 1);
  assert.equal(selectDominantSkinBoneIndex([], 3), null);
});
