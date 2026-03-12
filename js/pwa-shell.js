const OFFLINE_READY_KEY = "fieldRef.offlineReadySeen";
const APP_VERSION = "2026.03.12.2";

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

function showUpdateBanner(onReload) {
  const el = byId("pwaBanner");
  const text = byId("pwaBannerText");
  const dismissBtn = byId("dismissPwaBannerBtn");
  if (!el || !text) return;

  text.textContent = "A newer version of the app is ready. Tap reload to update.";

  let className = "mt-4 rounded-2xl border px-4 py-3 text-sm";
  className += " border-[#e5621c]/20 bg-[#e5621c]/10 text-white";

  el.className = className;
  el.classList.remove("hidden");

  let reloadBtn = document.getElementById("reloadAppBtn");
  if (!reloadBtn) {
    reloadBtn = document.createElement("button");
    reloadBtn.id = "reloadAppBtn";
    reloadBtn.type = "button";
    reloadBtn.className =
      "mt-3 w-full rounded-xl bg-[#e5621c] px-4 py-3 text-sm font-bold text-neutral-950";
    reloadBtn.textContent = "Reload App";
    el.appendChild(reloadBtn);
  }

  reloadBtn.onclick = onReload;

  if (dismissBtn) dismissBtn.classList.add("hidden");
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
        const registration = await navigator.serviceWorker.register("/sw.js");

        setInterval(() => {
          registration.update();
        }, 60 * 1000);

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              showUpdateBanner(() => {
                newWorker.postMessage({ type: "SKIP_WAITING" });
              });
            }
          });
        });

        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
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
