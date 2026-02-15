export const $ = (id) => document.getElementById(id);

export function toNum(id) {
  const el = $(id);
  if (!el) return 0;
  const v = Number.parseFloat(el.value);
  return Number.isFinite(v) ? v : 0;
}

export function fmt(n, d = 2) {
  return Number(n).toFixed(d);
}

export function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

export function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

export function initAccordion(root = document) {
  const groups = root.querySelectorAll("[data-accordion]");

  groups.forEach((group) => {
    if (group.dataset.bound === "1") return; // prevent double-binding
    group.dataset.bound = "1";

    group.addEventListener("click", (e) => {
      const btn = e.target.closest(".acc-trigger");
      if (!btn || !group.contains(btn)) return;

      const item = btn.closest(".acc-item");
      if (!item) return;

      // only react if this trigger belongs to THIS accordion level
      const ownerGroup = btn.closest("[data-accordion]");
      if (ownerGroup !== group) return;

      const isOpen = item.classList.contains("open");
      const allowMultiple = group.dataset.allowMultiple === "true";

      if (!allowMultiple) {
        group.querySelectorAll(":scope > .acc-item.open").forEach((i) => {
          if (i !== item) i.classList.remove("open");
        });
      }

      item.classList.toggle("open", !isOpen);
    });
  });
}


