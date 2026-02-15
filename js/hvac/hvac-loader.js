import { initAccordion } from "../core.js";

document.addEventListener("DOMContentLoaded", async () => {
  const mount = document.getElementById("hvacAccordion");
  if (!mount) return;

  const groups = [
    {
      title: "Pricing Tools",
      items: [
        {
          title: "Repair Quote Builder",
          file: "partials/hvac/pricing/repair-quote.html",
        },
        {
          title: "Replacement Estimator (Budgetary)",
          file: "partials/hvac/pricing/replacement-estimator.html",
        },
        {
          title: "Pricing Guardrails",
          file: "partials/hvac/pricing/pricing-guardrails.html",
        },
        {
          title: "Gross Margin Snapshot (Calculator)",
          file: "partials/hvac/pricing/gross-margin.html",
        },
      ],
    },
    {
      title: "Checklists",
      items: [
        {
          title: "Install Preparedness Checklist",
          file: "partials/hvac/checklists/install-preparedness.html",
        },
        {
          title: "Commissioning Closeout Gate",
          file: "partials/hvac/checklists/commissioning-gate.html",
        },
      ],
    },
    {
      title: "Logs",
      items: [
        {
          title: "Refrigerant Log",
          file: "partials/hvac/logs/refrigerant-log.html",
        },
      ],
    },
    {
      title: "Quick Reference",
      items: [
        {
          title: "Superheat Charging (Fixed Orifice)",
          file: "partials/hvac/reference/superheat.html",
        },
        {
          title: "Subcooling Charging (TXV)",
          file: "partials/hvac/reference/subcooling.html",
        },
        {
          title: "Static Pressure Diagnostics (TESP)",
          file: "partials/hvac/reference/static-pressure.html",
        },
        {
          title: "Delta-T (Temp Split) Quick Check",
          file: "partials/hvac/reference/delta-t.html",
        },
        {
          title: "Electrical Diagnostics",
          file: "partials/hvac/reference/electrical-diagnostics.html",
        },
        {
          title: "Refrigerant Symptom Matrix",
          file: "partials/hvac/reference/refrigerant-symptom-matrix.html",
        },
        {
          title: "Gas Furnace Sequence of Operation",
          file: "partials/hvac/reference/furnace-sequence.html",
        },
      ],
    },
  ];

  const groupCards = await Promise.all(
    groups.map(async (group) => {
      const itemCards = await Promise.all(
        group.items.map(async (item) => {
          try {
            const res = await fetch(item.file);
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            const panelHtml = await res.text();

            return `
              <article class="acc-item">
                <button class="acc-trigger" type="button">${item.title}</button>
                <div class="acc-panel">${panelHtml}</div>
              </article>
            `;
          } catch (err) {
            return `
              <article class="acc-item">
                <button class="acc-trigger" type="button">${item.title} (load error)</button>
                <div class="acc-panel">Failed to load <code>${item.file}</code><br>${err.message}</div>
              </article>
            `;
          }
        }),
      );

      return `
        <article class="acc-item">
          <button class="acc-trigger" type="button">${group.title}</button>
          <div class="acc-panel">
            <div class="accordion" data-accordion>
              ${itemCards.join("")}
            </div>
          </div>
        </article>
      `;
    }),
  );

  mount.innerHTML = groupCards.join("");
  initAccordion();
});
