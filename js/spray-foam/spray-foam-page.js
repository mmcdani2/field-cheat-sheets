import { initAccordion, loadPartial } from "../core.js";

document.addEventListener("DOMContentLoaded", async () => {
  const mount = document.getElementById("sprayFoamAccordion");
  if (!mount) return;

  try {
    const html = await loadPartial("partials/spray-foam/placeholder.html");
    mount.innerHTML = `
      <article class="acc-item open">
        <button class="acc-trigger" type="button">Coming Soon</button>
        <div class="acc-panel">${html}</div>
      </article>
    `;
    initAccordion();
  } catch (err) {
    mount.innerHTML = `
      <article class="acc-item open">
        <button class="acc-trigger" type="button">Load Error</button>
        <div class="acc-panel">${err.message}</div>
      </article>
    `;
  }
});