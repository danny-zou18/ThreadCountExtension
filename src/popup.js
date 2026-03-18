import { createSupabaseBrowserClient } from "./supabase.js";

const supabase = createSupabaseBrowserClient();

const CATEGORY_LABELS = {
  tops: "Tops",
  bottoms: "Bottoms",
  dresses: "Dresses",
  shoes: "Shoes",
  accessories: "Accessories",
  outerwear: "Outerwear",
};

const elements = {
  authForm: document.getElementById("authForm"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  submitBtn: document.getElementById("submitBtn"),
  resetBtn: document.getElementById("resetBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  sessionCard: document.getElementById("sessionCard"),
  sessionEmail: document.getElementById("sessionEmail"),
  wardrobeCard: document.getElementById("wardrobeCard"),
  wardrobeCount: document.getElementById("wardrobeCount"),
  wardrobeEmpty: document.getElementById("wardrobeEmpty"),
  wardrobeList: document.getElementById("wardrobeList"),
  status: document.getElementById("status"),
};

const state = {
  busy: false,
};

function setStatus(message, tone = "neutral") {
  elements.status.textContent = message;
  elements.status.className = `status${tone === "neutral" ? "" : ` ${tone}`}`;
}

function setBusy(isBusy) {
  state.busy = isBusy;

  for (const button of [
    elements.submitBtn,
    elements.resetBtn,
    elements.logoutBtn,
    elements.refreshBtn,
  ]) {
    if (button) {
      button.disabled = isBusy;
    }
  }
}

function formatCount(count) {
  return `${count} item${count === 1 ? "" : "s"}`;
}

function getItemImageUrl(imagePath) {
  if (!imagePath) {
    return null;
  }

  const { data } = supabase.storage.from("wardrobe").getPublicUrl(imagePath);
  return data.publicUrl;
}

function renderWardrobeItems(items) {
  elements.wardrobeList.replaceChildren();

  if (!items.length) {
    elements.wardrobeCount.textContent = formatCount(0);
    elements.wardrobeEmpty.textContent =
      "No wardrobe items yet. Add pieces on the website to see them here.";
    elements.wardrobeEmpty.classList.remove("hidden");
    return;
  }

  elements.wardrobeCount.textContent = formatCount(items.length);
  elements.wardrobeEmpty.classList.add("hidden");

  for (const item of items) {
    const article = document.createElement("article");
    article.className = "wardrobe-item";

    const imageUrl = getItemImageUrl(item.image_path);
    const thumb = document.createElement("div");
    thumb.className = "wardrobe-thumb";

    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = item.name;
      image.loading = "lazy";
      thumb.append(image);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "wardrobe-placeholder";
      placeholder.textContent = "No image";
      thumb.append(placeholder);
    }

    const copy = document.createElement("div");
    copy.className = "wardrobe-copy";

    const name = document.createElement("p");
    name.className = "wardrobe-name";
    name.textContent = item.name;

    const category = document.createElement("p");
    category.className = "wardrobe-category";
    category.textContent = CATEGORY_LABELS[item.category] || item.category;

    copy.append(name, category);

    const tags = [...(item.colors || []), ...(item.seasons || [])].slice(0, 3);

    if (tags.length) {
      const tagRow = document.createElement("div");
      tagRow.className = "wardrobe-tags";

      for (const value of tags) {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = value;
        tagRow.append(tag);
      }

      copy.append(tagRow);
    }

    article.append(thumb, copy);
    elements.wardrobeList.append(article);
  }
}

function resetWardrobe(message = "Sign in to load your wardrobe.") {
  elements.wardrobeList.replaceChildren();
  elements.wardrobeCount.textContent = formatCount(0);
  elements.wardrobeEmpty.textContent = message;
  elements.wardrobeEmpty.classList.remove("hidden");
  elements.wardrobeCard.classList.add("hidden");
}

async function fetchWardrobeItems(userId) {
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select(
      "id, user_id, name, category, image_path, labels, colors, seasons, is_inspiration, is_template, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

async function loadWardrobe(userId) {
  if (!userId) {
    throw new Error("No user id found for this session.");
  }

  elements.wardrobeCard.classList.remove("hidden");
  elements.wardrobeEmpty.textContent = "Loading your wardrobe…";
  elements.wardrobeEmpty.classList.remove("hidden");
  elements.wardrobeCount.textContent = "…";

  const items = await fetchWardrobeItems(userId);
  renderWardrobeItems(items);
}

async function renderSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  const email = session?.user?.email;
  const userId = session?.user?.id;
  const isSignedIn = Boolean(email);

  elements.sessionCard.classList.toggle("hidden", !isSignedIn);
  elements.authForm.closest(".card").classList.toggle("hidden", isSignedIn);

  if (isSignedIn) {
    elements.sessionEmail.textContent = email;
    try {
      await loadWardrobe(userId);
      setStatus("Session ready. Your wardrobe is loaded.", "success");
    } catch (wardrobeError) {
      resetWardrobe("We could not load your wardrobe right now.");
      elements.wardrobeCard.classList.remove("hidden");
      setStatus(
        wardrobeError.message || "Unable to load wardrobe items.",
        "error",
      );
      return;
    }

    return;
  }

  elements.sessionEmail.textContent = "";
  resetWardrobe();
  setStatus(
    "No saved session. Sign in with your existing account to continue.",
  );
}

async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  setStatus("Signed in successfully.", "success");
}

async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) {
    throw error;
  }

  setStatus("Password reset email sent. Check your inbox.", "success");
}

elements.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = elements.email.value.trim();
  const password = elements.password.value;

  if (!email || !password) {
    setStatus("Email and password are required.", "error");
    return;
  }

  try {
    setBusy(true);
    setStatus("Signing in…");
    await signIn(email, password);
    await renderSession();
  } catch (error) {
    setStatus(error.message || "Authentication failed.", "error");
  } finally {
    setBusy(false);
  }
});

elements.resetBtn.addEventListener("click", async () => {
  const email = elements.email.value.trim();

  if (!email) {
    setStatus(
      "Enter your email first so the reset link goes to the right inbox.",
      "error",
    );
    return;
  }

  try {
    setBusy(true);
    setStatus("Sending password reset email…");
    await resetPassword(email);
  } catch (error) {
    setStatus(error.message || "Unable to send password reset email.", "error");
  } finally {
    setBusy(false);
  }
});

elements.logoutBtn.addEventListener("click", async () => {
  try {
    setBusy(true);
    setStatus("Signing out…");

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    elements.password.value = "";
    await renderSession();
  } catch (error) {
    setStatus(error.message || "Unable to sign out.", "error");
  } finally {
    setBusy(false);
  }
});

elements.refreshBtn.addEventListener("click", async () => {
  try {
    setBusy(true);
    setStatus("Refreshing session…");

    const { error } = await supabase.auth.refreshSession();

    if (error) {
      throw error;
    }

    await renderSession();
  } catch (error) {
    setStatus(error.message || "Unable to refresh session.", "error");
  } finally {
    setBusy(false);
  }
});

supabase.auth.onAuthStateChange(async (event) => {
  if (
    event === "SIGNED_IN" ||
    event === "SIGNED_OUT" ||
    event === "TOKEN_REFRESHED"
  ) {
    await renderSession();
  }
});

renderSession();
