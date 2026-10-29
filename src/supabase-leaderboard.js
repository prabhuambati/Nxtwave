import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const leaderboardConfigured = Boolean(
  url?.startsWith("https://") && url.includes(".supabase.co") && key?.startsWith("sb_")
);
export const supabase = leaderboardConfigured ? createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
}) : null;

export function getManagementToken() {
  const keyName = "nxtwaveBot.managementToken.v1";
  let token = localStorage.getItem(keyName);
  if (!token) {
    token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    localStorage.setItem(keyName, token);
  }
  return token;
}

export function getVoterKey() {
  const keyName = "nxtwaveBot.voterKey.v1";
  let token = localStorage.getItem(keyName);
  if (!token) {
    token = crypto.randomUUID().replaceAll("-", "");
    localStorage.setItem(keyName, token);
  }
  return token;
}

const ownedCreationsKey = "nxtwaveBot.ownedCreations.v1";
const ownedTokensKey = "nxtwaveBot.ownedTokens.v1";
const likedCreationsKey = "nxtwaveBot.likedCreations.v1";

export function isCreationLiked(creationId) {
  try {
    const liked = JSON.parse(localStorage.getItem(likedCreationsKey) ?? "[]");
    return Array.isArray(liked) && liked.includes(String(creationId));
  } catch {
    return false;
  }
}

function rememberLikedCreation(creationId) {
  try {
    const liked = JSON.parse(localStorage.getItem(likedCreationsKey) ?? "[]");
    const next = Array.isArray(liked) ? liked.filter(id => id !== String(creationId)).concat(String(creationId)) : [String(creationId)];
    localStorage.setItem(likedCreationsKey, JSON.stringify(next.slice(-250)));
  } catch {
    // The server duplicate constraint remains authoritative.
  }
}

function createManagementToken() {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

export function isOwnCreation(creationId) {
  try {
    const owned = JSON.parse(localStorage.getItem(ownedCreationsKey) ?? "[]");
    return Array.isArray(owned) && owned.includes(creationId);
  } catch {
    return false;
  }
}

function rememberOwnedCreation(creationId, managementToken) {
  try {
    const owned = JSON.parse(localStorage.getItem(ownedCreationsKey) ?? "[]");
    const next = Array.isArray(owned) ? owned.filter(id => id !== creationId).concat(creationId) : [creationId];
    localStorage.setItem(ownedCreationsKey, JSON.stringify(next.slice(-50)));

    const tokens = JSON.parse(localStorage.getItem(ownedTokensKey) ?? "{}");
    const nextTokens = tokens && typeof tokens === "object" ? tokens : {};
    nextTokens[String(creationId)] = managementToken;
    localStorage.setItem(ownedTokensKey, JSON.stringify(nextTokens));
  } catch {
    // Ownership remains protected by the management token; this local hint is only a UI convenience.
  }
}

export function getThumbnailUrl(path) {
  if (!path || !supabase) return null;
  const { data } = supabase.storage.from("bot-thumbnails").getPublicUrl(path);
  return data?.publicUrl ?? null;
}

async function fetchGalleryQuery(sort = "top") {
  if (!supabase) throw new Error("The public leaderboard is not configured.");
  let query = supabase
    .from("bot_gallery")
    .select("id,display_name,recipe,thumbnail_path,like_count,created_at")
    .limit(50);
  if (sort === "recent") {
    query = query.order("created_at", { ascending: false });
  } else if (sort === "liked") {
    query = query.order("like_count", { ascending: false }).order("created_at", { ascending: false });
  } else {
    query = query.order("like_count", { ascending: false }).order("created_at", { ascending: true });
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export function fetchPublicCreations(sort = "top") {
  return fetchGalleryQuery(sort);
}

export function fetchLeaderboard() {
  return fetchGalleryQuery("top");
}

export async function publishCreation({ displayName, recipe, thumbnailBlob }) {
  if (!supabase) throw new Error("The public leaderboard is not configured.");
  const managementToken = createManagementToken();
  const creationId = crypto.randomUUID();
  let thumbnailPath = null;
  if (thumbnailBlob) {
    thumbnailPath = `public/${creationId}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("bot-thumbnails")
      .upload(thumbnailPath, thumbnailBlob, { contentType: "image/jpeg", upsert: false });
    if (uploadError) throw uploadError;
  }
  const { data, error } = await supabase.rpc("publish_bot_creation", {
    p_creation_id: creationId,
    p_display_name: displayName,
    p_recipe: recipe,
    p_thumbnail_path: thumbnailPath,
    p_management_token: managementToken,
    p_image_consent: true
  });
  if (error) throw error;
  if (data) rememberOwnedCreation(String(data), managementToken);
  return data;
}

export async function likeCreation(creationId) {
  if (!supabase) throw new Error("The public leaderboard is not configured.");
  const { data, error } = await supabase.rpc("like_bot_creation", {
    p_creation_id: creationId,
    p_voter_key: getVoterKey()
  });
  if (error) throw error;
  rememberLikedCreation(creationId);
  return data;
}

export async function withdrawCreation(creationId) {
  if (!supabase) throw new Error("The public leaderboard is not configured.");
  let managementToken = getManagementToken();
  try {
    const tokens = JSON.parse(localStorage.getItem(ownedTokensKey) ?? "{}");
    if (tokens && typeof tokens === "object" && tokens[String(creationId)]) {
      managementToken = tokens[String(creationId)];
    }
  } catch {
    // Fall back to the legacy browser management token.
  }
  const { data, error } = await supabase.rpc("withdraw_bot_creation", {
    p_creation_id: creationId,
    p_management_token: managementToken
  });
  if (error) throw error;
  return data;
}

export async function reportCreation(creationId, reason) {
  if (!supabase) throw new Error("The public leaderboard is not configured.");
  const { data, error } = await supabase.rpc("report_bot_creation", {
    p_creation_id: creationId,
    p_reason: reason,
    p_reporter_key: getVoterKey()
  });
  if (error) throw error;
  return data;
}
