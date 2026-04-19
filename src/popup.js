import { createSupabaseBrowserClient } from "./supabase.js";
import {
  CATEGORY_LABELS,
  LAST_SAVE_KEY,
  PENDING_SAVE_KEY,
  buildWardrobeItemName,
  fetchWardrobeItems,
  formatCount,
  getItemImageUrl,
  saveRemoteImageToWardrobe,
} from "./wardrobe.js";

const supabase = createSupabaseBrowserClient();

function log(step, details) {
  if (details === undefined) {
    console.log(`[ThreadCount popup] ${step}`);
    return;
  }

  console.log(`[ThreadCount popup] ${step}`, details);
}

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
  saveFeedback: document.getElementById("saveFeedback"),
  status: document.getElementById("status"),
  pendingSaveCard: document.getElementById("pendingSaveCard"),
  pendingImage: document.getElementById("pendingImage"),
  pendingName: document.getElementById("pendingName"),
  pendingCategory: document.getElementById("pendingCategory"),
  pendingSaveBtn: document.getElementById("pendingSaveBtn"),
  pendingCancelBtn: document.getElementById("pendingCancelBtn"),
};

const state = {
  busy: false,
};

let renderSessionScheduled = false;

function setStatus(message, tone = "neutral") {
  log("setStatus", { message, tone });
  elements.status.textContent = message;
  elements.status.className = `status${tone === "neutral" ? "" : ` ${tone}`}`;
}

function setBusy(isBusy) {
  log("setBusy", { isBusy });
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

function renderSaveFeedback(entry) {
  if (!entry) {
    elements.saveFeedback.textContent =
      "Right-click any image in your browser and choose Save to Wardrobe.";
    elements.saveFeedback.className = "feedback";
    return;
  }

  elements.saveFeedback.textContent = entry.message;
  elements.saveFeedback.className = `feedback${entry.status ? ` ${entry.status}` : ""}`;
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

    const imageUrl = getItemImageUrl(supabase, item.image_path);
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

async function loadWardrobe(userId) {
  log("loadWardrobe:start", { userId });

  if (!userId) {
    throw new Error("No user id found for this session.");
  }

  elements.wardrobeCard.classList.remove("hidden");
  elements.wardrobeEmpty.textContent = "Loading your wardrobe…";
  elements.wardrobeEmpty.classList.remove("hidden");
  elements.wardrobeCount.textContent = "…";

  const items = await fetchWardrobeItems(supabase, userId);
  log("loadWardrobe:success", { count: items.length });
  renderWardrobeItems(items);
}

async function loadSaveFeedback() {
  log("loadSaveFeedback:start");
  const storage = globalThis.chrome?.storage?.local;

  if (!storage) {
    log("loadSaveFeedback:no-storage");
    renderSaveFeedback();
    return;
  }

  const result = await storage.get([LAST_SAVE_KEY]);
  log("loadSaveFeedback:result", result[LAST_SAVE_KEY] || null);
  renderSaveFeedback(result[LAST_SAVE_KEY]);
}

async function renderSession() {
  log("renderSession:start");
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    log("renderSession:getSession-error", error);
    setStatus(error.message, "error");
    return;
  }

  const email = session?.user?.email;
  const userId = session?.user?.id;
  const isSignedIn = Boolean(email);

  log("renderSession:session", {
    isSignedIn,
    email: email || null,
    userId: userId || null,
  });

  elements.sessionCard.classList.toggle("hidden", !isSignedIn);
  elements.authForm.closest(".card").classList.toggle("hidden", isSignedIn);

  if (isSignedIn) {
    elements.sessionEmail.textContent = email;
    elements.sessionCard.classList.remove("hidden");

    try {
      await loadWardrobe(userId);
      log("renderSession:wardrobe-loaded");
      setStatus("Session ready. Your wardrobe is loaded.", "success");
    } catch (wardrobeError) {
      log("renderSession:wardrobe-error", wardrobeError);
      elements.wardrobeCard.classList.remove("hidden");
      elements.wardrobeList.replaceChildren();
      elements.wardrobeCount.textContent = formatCount(0);
      elements.wardrobeEmpty.textContent =
        "Signed in, but we could not load your wardrobe right now.";
      elements.wardrobeEmpty.classList.remove("hidden");
      setStatus("Signed in successfully.", "success");
      renderSaveFeedback({
        status: "error",
        message:
          wardrobeError.message || "Unable to load wardrobe items right now.",
      });
    }

    return;
  }

  elements.sessionEmail.textContent = "";
  resetWardrobe();
  setStatus(
    "No saved session. Sign in with your existing account to continue.",
  );
}

function scheduleRenderSession(reason) {
  log("scheduleRenderSession", {
    reason,
    alreadyScheduled: renderSessionScheduled,
  });

  if (renderSessionScheduled) {
    return;
  }

  renderSessionScheduled = true;

  globalThis.setTimeout(async () => {
    renderSessionScheduled = false;

    try {
      await renderSession();
    } catch (error) {
      log("scheduleRenderSession:error", error);
      setStatus(error.message || "Unable to refresh session.", "error");
    }
  }, 0);
}

async function signIn(email, password) {
  log("signIn:start", { email });
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    log("signIn:error", error);
    throw error;
  }

  log("signIn:success", { email });
  setStatus("Signed in successfully.", "success");
}

async function resetPassword(email) {
  log("resetPassword:start", { email });
  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) {
    log("resetPassword:error", error);
    throw error;
  }

  log("resetPassword:success", { email });
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
    log("authForm:submit", { email });
    setBusy(true);
    setStatus("Signing in…");

    const signInWatchdog = setTimeout(() => {
      log("signIn:watchdog-timeout", { email });
    }, 8000);

    try {
      await signIn(email, password);
    } finally {
      clearTimeout(signInWatchdog);
    }

    log("authForm:signIn-finished", { email });
    await renderSession();
    log("authForm:renderSession-finished", { email });
  } catch (error) {
    log("authForm:error", error);
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
    log("logout:start");
    setBusy(true);
    setStatus("Signing out…");

    const { error } = await supabase.auth.signOut();

    if (error) {
      log("logout:error", error);
      throw error;
    }

    log("logout:success");
    elements.password.value = "";
    await renderSession();
  } catch (error) {
    log("logout:catch", error);
    setStatus(error.message || "Unable to sign out.", "error");
  } finally {
    setBusy(false);
  }
});

elements.refreshBtn.addEventListener("click", async () => {
  try {
    log("refresh:start");
    setBusy(true);
    setStatus("Refreshing session…");

    const { error } = await supabase.auth.refreshSession();

    if (error) {
      log("refresh:error", error);
      throw error;
    }

    log("refresh:success");
    await renderSession();
  } catch (error) {
    log("refresh:catch", error);
    setStatus(error.message || "Unable to refresh session.", "error");
  } finally {
    setBusy(false);
  }
});

supabase.auth.onAuthStateChange((event) => {
  log("authStateChange", { event });
  if (
    event === "SIGNED_IN" ||
    event === "SIGNED_OUT" ||
    event === "TOKEN_REFRESHED"
  ) {
    scheduleRenderSession(`auth:${event}`);
  }
});

globalThis.chrome?.storage?.onChanged?.addListener(
  async (changes, areaName) => {
    log("storage:onChanged", {
      areaName,
      hasLastSave: Boolean(changes[LAST_SAVE_KEY]),
    });
    if (areaName !== "local" || !changes[LAST_SAVE_KEY]) {
      return;
    }

    renderSaveFeedback(changes[LAST_SAVE_KEY].newValue);

    if (changes[LAST_SAVE_KEY].newValue?.status === "success") {
      scheduleRenderSession("storage:last-save-success");
    }
  },
);

globalThis.addEventListener("error", (event) => {
  log("window:error", {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

globalThis.addEventListener("unhandledrejection", (event) => {
  log("window:unhandledrejection", event.reason);
});

// --- Pending save (edit before saving) ---

async function checkPendingSave() {
  const storage = globalThis.chrome?.storage?.local;
  if (!storage) return;

  const result = await storage.get([PENDING_SAVE_KEY]);
  const pending = result[PENDING_SAVE_KEY];

  if (!pending || !pending.srcUrl) return;

  // Check it's not stale (older than 5 minutes)
  if (Date.now() - pending.timestamp > 5 * 60 * 1000) {
    await storage.remove([PENDING_SAVE_KEY]);
    return;
  }

  log("checkPendingSave:found", pending);

  // Pre-fill the form
  const suggestedName = buildWardrobeItemName(pending);
  elements.pendingName.value = suggestedName;
  elements.pendingCategory.value = "accessories";
  elements.pendingImage.src = pending.srcUrl;
  elements.pendingSaveCard.classList.remove("hidden");

  setStatus("Edit the item details, then click Save.", "success");
}

async function clearPendingSave() {
  const storage = globalThis.chrome?.storage?.local;
  if (storage) {
    await storage.remove([PENDING_SAVE_KEY]);
  }
  elements.pendingSaveCard.classList.add("hidden");
}

elements.pendingCancelBtn.addEventListener("click", async () => {
  log("pendingSave:cancel");
  await clearPendingSave();
  setStatus("Save cancelled.", "neutral");
});

elements.pendingSaveBtn.addEventListener("click", async () => {
  const storage = globalThis.chrome?.storage?.local;
  if (!storage) return;

  const result = await storage.get([PENDING_SAVE_KEY]);
  const pending = result[PENDING_SAVE_KEY];

  if (!pending || !pending.srcUrl) {
    setStatus("No pending image found.", "error");
    await clearPendingSave();
    return;
  }

  const name = elements.pendingName.value.trim();
  const category = elements.pendingCategory.value;

  if (!name) {
    setStatus("Please enter a name for this item.", "error");
    return;
  }

  try {
    setBusy(true);
    setStatus("Saving to wardrobe…");

    const saveResult = await saveRemoteImageToWardrobe(supabase, {
      srcUrl: pending.srcUrl,
      pageUrl: pending.pageUrl,
      pageTitle: pending.pageTitle,
      nameOverride: name,
      categoryOverride: category,
    });

    const message = `Saved "${saveResult.item.name}" to your wardrobe.`;
    log("pendingSave:success", { itemId: saveResult.item.id, name: saveResult.item.name });

    await clearPendingSave();

    // Update last-save feedback
    await storage.set({
      [LAST_SAVE_KEY]: { status: "success", message, timestamp: Date.now() },
    });

    setStatus(message, "success");
    scheduleRenderSession("pending-save-success");
  } catch (error) {
    log("pendingSave:error", error);
    setStatus(error?.message || "Unable to save this image.", "error");
  } finally {
    setBusy(false);
  }
});

loadSaveFeedback();
scheduleRenderSession("startup");
checkPendingSave();
