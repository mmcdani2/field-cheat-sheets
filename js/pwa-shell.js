const OFFLINE_READY_KEY = "fieldRef.offlineReadySeen";

let deferredPrompt = null;

function byId(id) {
  return document.getElementById(id);
}

function setConnectionState() {
  const dot = byId("pwaConnectionDot");
  const text = byId("pwaConnectionText");
  if (!dot || !text) return;

  if (navigator.onLine) {
    dot.className = "h-2 w-2 rounded-full bg-emerald-300";
    text.textContent = "Online";
  } else {
    dot.className = "h-2 w-2 rounded-full bg-amber-300";
    text.textContent = "Offline";
  }
}

function showBanner(message, type = "info") {
  const el = byId("pwaBanner");
  const text = byId("pwaBannerText");
  if (!el || !text) return;

  text.textContent = message;

  let className = "mt-4 rounded-2xl border px-4 py-3 text-sm";

  if (type === "success") {
    className += " border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  } else if (type === "warn") {
    className += " border-amber-400/20 bg-amber-500/10 text-amber-100";
  } else {
    className += " border-[#e5621c]/20 bg-[#e5621c]/10 text-cyan-100";
  }

  el.className = className;
  el.classList.remove("hidden");
}

function hideBanner() {
  const el = byId("pwaBanner");
  if (!el) return;
  el.classList.add("hidden");
}

function showInstallButton() {
  byId("installAppBtn")?.classList.remove("hidden");
}

function hideInstallButton() {
  byId("installAppBtn")?.classList.add("hidden");
}

function bindBannerDismiss() {
  byId("dismissPwaBannerBtn")?.addEventListener("click", () => {
    hideBanner();
  });
}

function bindInstallButton() {
  byId("installAppBtn")?.addEventListener("click", async () => {
    if (!deferredPrompt) {
      showBanner("Use your browser menu to install the app.", "warn");
      showInstallButton();
      return;
    }

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    hideInstallButton();
  });
}

function maybeShowOfflineReady() {
  if (localStorage.getItem(OFFLINE_READY_KEY) === "1") return;

  showBanner("Offline mode ready.", "success");
  localStorage.setItem(OFFLINE_READY_KEY, "1");
}

function registerServiceWorker() {
  if (
    "serviceWorker" in navigator &&
    location.hostname !== "localhost" &&
    location.hostname !== "127.0.0.1"
  ) {
    window.addEventListener("load", async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch (err) {
        console.error("SW registration failed:", err);
      }
    });
  }
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  showInstallButton();
});

window.addEventListener("appinstalled", () => {
  hideInstallButton();
  showBanner("App installed successfully.", "success");
});

window.addEventListener("online", setConnectionState);
window.addEventListener("offline", setConnectionState);

bindBannerDismiss();
bindInstallButton();
setConnectionState();
registerServiceWorker();
