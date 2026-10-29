export const CREATION_VERSION = 1;
export const MAX_CREATION_COMPONENTS = 40;
export const MAX_ENCODED_CREATION_LENGTH = 6000;
export const MAX_CREATION_URL_LENGTH = 8000;

export const CREATION_POSES = Object.freeze([
  "idle",
  "t-pose",
  "arms-raised",
  "arms-crossed",
  "one-legged-balance"
]);

export const CREATION_COMPONENTS = Object.freeze([
  "horn-crystal",
  "horn-curved",
  "wings",
  "extra-eyes",
  "tail",
  "halo",
  "spikes"
]);

export const CREATION_ANCHORS = Object.freeze(["head", "torso", "hips"]);

export const DEFAULT_CREATION = Object.freeze({
  version: CREATION_VERSION,
  pose: "idle",
  components: Object.freeze([])
});

export function validateCreationRecipe(recipe) {
  if (!recipe || typeof recipe !== "object" || Array.isArray(recipe)) {
    throw new TypeError("The creation recipe must be an object.");
  }
  if (recipe.version !== CREATION_VERSION) {
    throw new RangeError(`Unsupported creation recipe version: ${recipe.version}.`);
  }
  if (!CREATION_POSES.includes(recipe.pose)) {
    throw new RangeError("The creation recipe contains an unsupported pose.");
  }
  if (!Array.isArray(recipe.components) || recipe.components.length > MAX_CREATION_COMPONENTS) {
    throw new RangeError("The creation recipe has an invalid number of components.");
  }

  const components = recipe.components.map((component, index) => {
    if (!component || typeof component !== "object" || Array.isArray(component)) {
      throw new TypeError(`Creation component ${index + 1} must be an object.`);
    }
    if (!CREATION_COMPONENTS.includes(component.id)) {
      throw new RangeError(`Creation component ${index + 1} has an unsupported type.`);
    }
    if (!CREATION_ANCHORS.includes(component.anchor)) {
      throw new RangeError(`Creation component ${index + 1} has an unsupported anchor.`);
    }
    const offset = validateVector(component.offset, 3, -5, 5, `component ${index + 1} offset`);
    const rotation = validateVector(component.rotation, 4, -1, 1, `component ${index + 1} rotation`);
    const quaternionLength = Math.hypot(...rotation);
    if (quaternionLength < 0.99 || quaternionLength > 1.01) {
      throw new RangeError(`Creation component ${index + 1} has an invalid rotation.`);
    }
    return { id: component.id, anchor: component.anchor, offset, rotation };
  });

  return { version: CREATION_VERSION, pose: recipe.pose, components };
}

export function encodeCreationRecipe(recipe) {
  const validated = validateCreationRecipe(recipe);
  const compact = {
    v: CREATION_VERSION,
    p: validated.pose,
    c: validated.components.map(({ id, anchor, offset, rotation }) => [
      id,
      anchor,
      offset.map(value => round(value, 5)),
      rotation.map(value => round(value, 6))
    ])
  };
  const bytes = new TextEncoder().encode(JSON.stringify(compact));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
  if (encoded.length > MAX_ENCODED_CREATION_LENGTH) {
    throw new RangeError("This creation is too large to share in a URL.");
  }
  return encoded;
}

export function decodeCreationRecipe(encoded) {
  if (typeof encoded !== "string" || !encoded || encoded.length > MAX_ENCODED_CREATION_LENGTH) {
    throw new RangeError("The shared creation is empty or too large.");
  }
  if (!/^[A-Za-z0-9_-]+$/u.test(encoded)) {
    throw new TypeError("The shared creation contains invalid URL-safe data.");
  }
  let compact;
  try {
    const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    compact = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new TypeError("The shared creation is malformed.");
  }
  if (!compact || typeof compact !== "object" || Array.isArray(compact)) {
    throw new TypeError("The shared creation is malformed.");
  }
  if (compact.v !== CREATION_VERSION) {
    throw new RangeError(`Unsupported creation recipe version: ${compact.v}.`);
  }
  if (!Array.isArray(compact.c)) {
    throw new TypeError("The shared creation has no component list.");
  }
  const components = compact.c.map((component, index) => {
    if (!Array.isArray(component) || component.length !== 4) {
      throw new TypeError(`Shared component ${index + 1} is malformed.`);
    }
    return {
      id: component[0],
      anchor: component[1],
      offset: component[2],
      rotation: component[3]
    };
  });
  return validateCreationRecipe({ version: compact.v, pose: compact.p, components });
}

export function readCreationFromUrl(url) {
  const parsedUrl = new URL(url, globalThis.location?.href ?? "http://localhost/");
  const encoded = parsedUrl.searchParams.get("creation");
  if (encoded === null) {
    return { valid: true, shared: false, recipe: DEFAULT_CREATION };
  }
  try {
    return { valid: true, shared: true, recipe: decodeCreationRecipe(encoded) };
  } catch (error) {
    return {
      valid: false,
      shared: true,
      recipe: DEFAULT_CREATION,
      error: error instanceof Error ? error.message : "The shared creation is invalid."
    };
  }
}

export function createCreationUrl(recipe, currentUrl) {
  const url = new URL(currentUrl);
  url.searchParams.set("creation", encodeCreationRecipe(recipe));
  if (url.href.length > MAX_CREATION_URL_LENGTH) {
    throw new RangeError("The share URL exceeds the safe browser length limit.");
  }
  return url.href;
}

function validateVector(value, length, minimum, maximum, label) {
  if (!Array.isArray(value) || value.length !== length
    || value.some(number => typeof number !== "number"
      || !Number.isFinite(number)
      || number < minimum
      || number > maximum)) {
    throw new RangeError(`The ${label} is outside the supported numeric limits.`);
  }
  return [...value];
}

function round(value, precision) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
