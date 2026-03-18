import { createSupabaseBrowserClient } from "./supabase.js";
import { LAST_SAVE_KEY, saveRemoteImageToWardrobe } from "./wardrobe.js";

const MENU_ID = "threadcount-save-image";
const supabase = createSupabaseBrowserClient();

function log(step, details) {
  if (details === undefined) {
    console.log(`[ThreadCount background] ${step}`);
    return;
  }

  console.log(`[ThreadCount background] ${step}`, details);
}

function createNotification(title, message) {
  if (!globalThis.chrome?.notifications?.create) {
    return;
  }

  chrome.notifications.create({
    type: "basic",
    iconUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAQAAAAAYLlVAAAAw0lEQVR4Ae3XsQ2CQBBG4XcQQJAEJIQiSEIkhCJIQiSEIkgfHgPce8CN7szvJt7l7M7OXQghhBBCCCGEkL8S7w5Bh2nT1Wv9K3HrxJ9gB8zW3n2Jd3f5K+zS6wG0m8g+tr5L0vL7AVzZ8C5aP4n0eT0z9wLr9nYd8k+v8JbY2mGvVx8kV4dr6wK1TzM9f22Yf1t8W7k9V8JfP3A7XvLk7w5x4V6T+4Qf3z2Q7k6kP9Wv8t8l7C5H4D3TQhBBCCCGEEEIIIYQQ8h98AWM2pj3B7l2PAAAAAElFTkSuQmCC",
    title,
    message,
  });
}

async function writeLastSaveResult(status, message) {
  log("writeLastSaveResult", { status, message });
  await chrome.storage.local.set({
    [LAST_SAVE_KEY]: {
      status,
      message,
      timestamp: Date.now(),
    },
  });
}

async function flashBadge(text, color) {
  if (!chrome.action?.setBadgeText) {
    return;
  }

  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });

  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" });
  }, 5000);
}

function ensureContextMenu() {
  log("ensureContextMenu:start");
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      log("ensureContextMenu:removeAll-error", chrome.runtime.lastError.message);
    }

    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Save to Wardrobe",
      contexts: ["image", "page"],
    }, () => {
      if (chrome.runtime.lastError) {
        log("ensureContextMenu:create-error", chrome.runtime.lastError.message);
        return;
      }

      log("ensureContextMenu:created");
    });
  });
}

async function handleSaveImage(info, tab) {
  log("handleSaveImage:start", {
    hasSrcUrl: Boolean(info.srcUrl),
    pageUrl: tab?.url || null,
    pageTitle: tab?.title || null,
  });

  if (!info.srcUrl) {
    const message =
      "No direct image was detected. Right-click the actual image, or open the image in a new tab first.";
    await writeLastSaveResult("error", message);
    await flashBadge("!", "#c4391c");
    createNotification("Save to Wardrobe failed", message);
    return;
  }

  try {
    const result = await saveRemoteImageToWardrobe(supabase, {
      srcUrl: info.srcUrl,
      pageUrl: tab?.url,
      pageTitle: tab?.title,
    });

    const message = `Saved ${result.item.name} to your wardrobe.`;
    log("handleSaveImage:success", { itemId: result.item.id, name: result.item.name });
    await writeLastSaveResult("success", message);
    await flashBadge("OK", "#2d7a3a");
    createNotification("Saved to Wardrobe", message);
  } catch (error) {
    log("handleSaveImage:error", error);
    const message =
      error?.message || "Unable to save this image to your wardrobe.";
    await writeLastSaveResult("error", message);
    await flashBadge("!", "#c4391c");
    createNotification("Save to Wardrobe failed", message);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  log("runtime:onInstalled");
  ensureContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  log("runtime:onStartup");
  ensureContextMenu();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  log("contextMenus:onClicked", {
    menuItemId: info.menuItemId,
    hasSrcUrl: Boolean(info.srcUrl),
  });

  if (info.menuItemId !== MENU_ID) {
    return;
  }

  handleSaveImage(info, tab);
});

ensureContextMenu();
