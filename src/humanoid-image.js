export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 1024;
export const MIN_IMAGE_BADGE_SCALE = 0.5;
export const DEFAULT_IMAGE_BADGE_SCALE = 1.5;
export const MAX_IMAGE_BADGE_SCALE = 3;
export const INITIAL_IMAGE_UPLOAD_CREDITS = 5;
export const IMAGE_CREDIT_STORAGE_KEY = "nxtwaveBot.imageCredits.v1";
export const REFERRAL_CREDIT_STORAGE_KEY = "nxtwaveBot.referralClaimed.v1";
export const ACCEPTED_IMAGE_TYPES = Object.freeze([
  "image/png",
  "image/jpeg",
  "image/webp"
]);

export function readImageCredits(storage = globalThis.localStorage) {
  if (!storage) return INITIAL_IMAGE_UPLOAD_CREDITS;
  try {
    const raw = storage.getItem(IMAGE_CREDIT_STORAGE_KEY);
    if (raw === null) {
      storage.setItem(IMAGE_CREDIT_STORAGE_KEY, String(INITIAL_IMAGE_UPLOAD_CREDITS));
      return INITIAL_IMAGE_UPLOAD_CREDITS;
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) throw new RangeError("invalid credits");
    return parsed;
  } catch {
    return INITIAL_IMAGE_UPLOAD_CREDITS;
  }
}

export function claimReferralBonus(referralCode, storage = globalThis.localStorage) {
  if (!referralCode || typeof referralCode !== "string") return { claimed: false, credits: readImageCredits(storage) };
  if (!storage) return { claimed: false, credits: readImageCredits(storage) };
  try {
    if (storage.getItem(REFERRAL_CREDIT_STORAGE_KEY)) return { claimed: false, credits: readImageCredits(storage) };
    storage.setItem(REFERRAL_CREDIT_STORAGE_KEY, referralCode.slice(0, 80));
    const current = readImageCredits(storage);
    const credits = current + 5;
    storage.setItem(IMAGE_CREDIT_STORAGE_KEY, String(credits));
    return { claimed: true, credits };
  } catch {
    return { claimed: false, credits: readImageCredits(storage) };
  }
}

export function consumeImageCredit(storage = globalThis.localStorage) {
  const remaining = readImageCredits(storage);
  if (remaining <= 0) throw new RangeError("No image-upload credits remain.");
  const next = remaining - 1;
  try { storage?.setItem(IMAGE_CREDIT_STORAGE_KEY, String(next)); } catch {}
  return next;
}

export function validateImageBadgeTransform(scale, rotationDegrees) {
  if (!Number.isFinite(scale) || scale < MIN_IMAGE_BADGE_SCALE || scale > MAX_IMAGE_BADGE_SCALE) {
    throw new RangeError("Image badge size must be between 0.5× and 3×.");
  }
  if (!Number.isFinite(rotationDegrees) || rotationDegrees < -180 || rotationDegrees > 180) {
    throw new RangeError("Image badge rotation must be between -180° and 180°.");
  }
  return true;
}

export function validateImageFile(file) {
  if (!file || typeof file !== "object") {
    throw new TypeError("Choose a PNG, JPEG, or WebP image.");
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new TypeError("Only PNG, JPEG, and WebP images are supported.");
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new RangeError("The selected image is empty or invalid.");
  }
  if (file.size > MAX_IMAGE_FILE_SIZE) {
    throw new RangeError("Images must be 5 MB or smaller.");
  }
  return true;
}

export function selectDominantSkinBoneIndex(vertices, boneCount) {
  if (!Array.isArray(vertices) || vertices.length !== 3 || !Number.isInteger(boneCount) || boneCount <= 0) {
    return null;
  }
  const contributions = new Float64Array(boneCount);
  for (const vertex of vertices) {
    if (!Array.isArray(vertex?.indices) || !Array.isArray(vertex?.weights) ||
      vertex.indices.length !== vertex.weights.length || !Number.isFinite(vertex.barycentric) ||
      vertex.barycentric < 0) {
      return null;
    }
    for (let influence = 0; influence < vertex.indices.length; influence += 1) {
      const index = vertex.indices[influence];
      const weight = vertex.weights[influence];
      if (Number.isInteger(index) && index >= 0 && index < boneCount &&
        Number.isFinite(weight) && weight > 0) {
        contributions[index] += vertex.barycentric * weight;
      }
    }
  }
  let dominantIndex = -1;
  for (let index = 0; index < contributions.length; index += 1) {
    if (contributions[index] > (contributions[dominantIndex] ?? 0)) dominantIndex = index;
  }
  return dominantIndex >= 0 && contributions[dominantIndex] > 0 ? dominantIndex : null;
}

export async function prepareImageCanvas(file) {
  validateImageFile(file);
  if (typeof createImageBitmap !== "function") {
    throw new Error("This browser cannot decode local images for the 3D preview.");
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    if (!bitmap.width || !bitmap.height) {
      throw new Error("The selected image has invalid dimensions.");
    }
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The browser could not prepare the image preview.");
    context.drawImage(bitmap, 0, 0, width, height);
    return { canvas, width, height };
  } catch (error) {
    throw new Error(
      error instanceof Error ? `Could not decode this image: ${error.message}` : "Could not decode this image."
    );
  } finally {
    bitmap?.close();
  }
}
