export const CATEGORY_LABELS = {
  tops: "Tops",
  bottoms: "Bottoms",
  dresses: "Dresses",
  shoes: "Shoes",
  accessories: "Accessories",
  outerwear: "Outerwear",
};

export const LAST_SAVE_KEY = "threadcount:last-save-result";
export const PENDING_SAVE_KEY = "threadcount:pending-save";

const WARDROBE_SELECT_FIELDS =
  "id, user_id, name, category, image_path, labels, colors, seasons, is_inspiration, is_template, created_at, updated_at";

export function formatCount(count) {
  return `${count} item${count === 1 ? "" : "s"}`;
}

export function getItemImageUrl(supabase, imagePath) {
  if (!imagePath) {
    return null;
  }

  const { data } = supabase.storage.from("wardrobe").getPublicUrl(imagePath);
  return data.publicUrl;
}

export async function fetchWardrobeItems(supabase, userId) {
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select(WARDROBE_SELECT_FIELDS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function stripExtension(filename) {
  return filename.replace(/\.[a-z0-9]+$/i, "");
}

function humanize(value) {
  return value.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function titleCase(value) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function getNameFromImageUrl(srcUrl) {
  const parsed = safeUrl(srcUrl);

  if (!parsed) {
    return "";
  }

  const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();

  if (!lastSegment) {
    return "";
  }

  const decoded = decodeURIComponent(lastSegment);
  return titleCase(humanize(stripExtension(decoded)));
}

function getExtensionFromMimeType(mimeType) {
  const normalized = mimeType.toLowerCase();

  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  if (normalized.includes("avif")) return "avif";
  if (normalized.includes("svg")) return "svg";
  return "jpg";
}

function getSourceHost(pageUrl, srcUrl) {
  const parsed = safeUrl(pageUrl) || safeUrl(srcUrl);
  return parsed?.hostname?.replace(/^www\./, "") || "web";
}

export function buildWardrobeItemName({ srcUrl, pageTitle }) {
  const imageName = getNameFromImageUrl(srcUrl);

  if (imageName) {
    return imageName;
  }

  if (pageTitle?.trim()) {
    return pageTitle.trim();
  }

  return "Saved image";
}

export async function saveRemoteImageToWardrobe(supabase, payload) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  const user = session?.user;

  if (!user) {
    throw new Error(
      "Sign in to ThreadCount before saving images to your wardrobe.",
    );
  }

  const imageResponse = await fetch(payload.srcUrl);

  if (!imageResponse.ok) {
    throw new Error(
      `Unable to fetch the selected image (${imageResponse.status}).`,
    );
  }

  const blob = await imageResponse.blob();

  if (!blob.type.startsWith("image/")) {
    throw new Error("The selected file is not a supported image.");
  }

  const itemId = globalThis.crypto.randomUUID();
  const extension = getExtensionFromMimeType(blob.type);
  const imagePath = `${user.id}/${itemId}.${extension}`;
  const itemName = payload.nameOverride || buildWardrobeItemName(payload);
  const itemCategory = payload.categoryOverride || "accessories";
  const sourceHost = getSourceHost(payload.pageUrl, payload.srcUrl);

  const { error: uploadError } = await supabase.storage
    .from("wardrobe")
    .upload(imagePath, blob, {
      contentType: blob.type,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data, error: insertError } = await supabase
    .from("wardrobe_items")
    .insert({
      id: itemId,
      user_id: user.id,
      name: itemName,
      category: itemCategory,
      image_path: imagePath,
      labels: ["saved-from-extension", sourceHost],
      colors: [],
      seasons: [],
    })
    .select(WARDROBE_SELECT_FIELDS)
    .single();

  if (insertError) {
    await supabase.storage.from("wardrobe").remove([imagePath]);
    throw insertError;
  }

  return {
    item: data,
    user,
    sourceHost,
  };
}
