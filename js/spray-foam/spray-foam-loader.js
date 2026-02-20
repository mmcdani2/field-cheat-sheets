import { initAccordion } from "../core.js";
import { initSprayFoamWallAutogen } from "./spray-foam-calculator.js";

document.addEventListener("DOMContentLoaded", async () => {
  const mount = document.getElementById("sprayFoamAccordion");
  if (!mount) return;

  const sections = [
    {
      title: "Spray Insulation Estimator",
      file: "partials/spray-foam/full-job-estimator.html",
    },
    { title: "Yield Tracker", file: "partials/spray-foam/yield-tracker.html" },
    {
      title: "Cost per BF Calculator",
      file: "partials/spray-foam/cost-per-bf.html",
    },
    {
      title: "Field Quick Reference",
      file: "partials/spray-foam/quick-reference.html",
    },
  ];

  const cards = await Promise.all(
    sections.map(async (section) => {
      try {
        const res = await fetch(section.file);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const html = await res.text();

        return `
          <article class="acc-item">
            <button class="acc-trigger" type="button">${section.title}</button>
            <div class="acc-panel">${html}</div>
          </article>
        `;
      } catch (err) {
        return `
          <article class="acc-item">
            <button class="acc-trigger" type="button">${section.title} (load error)</button>
            <div class="acc-panel">Failed to load <code>${section.file}</code><br>${err.message}</div>
          </article>
        `;
      }
    }),
  );

  mount.innerHTML = cards.join("");
    initAccordion();
    initSprayFoamWallAutogen();
});



