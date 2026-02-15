const $ = (id) => document.getElementById(id);

const OC_COST_PER_BF = 0.09;
const CC_COST_PER_BF = 0.475;

const toNum = (id) => {
  const v = Number.parseFloat($(id)?.value || "0");
  return Number.isFinite(v) ? v : 0;
};

const fmt = (n, d = 2) => Number(n).toFixed(d);
const money = (n) => `$${Number(n).toFixed(2)}`;

const setText = (id, text) => {
  const el = $(id);
  if (el) el.textContent = text;
};

export function calcYieldTracker() {
  const area = toNum("areaSqft");
  const thickness = toNum("thicknessIn");
  const sets = toNum("setsUsed");
  const theoretical = toNum("theoreticalSetYield") || 4000;

  if (area <= 0 || thickness <= 0 || sets <= 0) {
    setText(
      "yieldResults",
      "Please enter valid Area, Thickness, and Sets Used.",
    );
    return;
  }

  const installedBF = area * thickness;
  const actualYieldPerSet = installedBF / sets;
  const eff = (actualYieldPerSet / theoretical) * 100;
  const waste = 100 - eff;

  setText(
    "yieldResults",
    `Installed BF: ${fmt(installedBF, 0)} BF
Actual Yield per Set: ${fmt(actualYieldPerSet, 0)} BF/set
Theoretical Yield per Set: ${fmt(theoretical, 0)} BF/set
Yield Efficiency: ${fmt(eff, 1)}%
Implied Waste/Loss: ${fmt(waste, 1)}%`,
  );
}

export function calcCostPerBF() {
  const setCost = toNum("setCost");
  const expectedYield = toNum("expectedYield");

  if (setCost <= 0 || expectedYield <= 0) {
    setText("costResults", "Please enter valid Set Cost and Expected Yield.");
    return;
  }

  const cost = setCost / expectedYield;
  const sell40 = cost / 0.6;
  const sell50 = cost / 0.5;
  const sell60 = cost / 0.4;

  setText(
    "costResults",
    `Cost per BF: $${fmt(cost, 3)}

Suggested Sell Targets:
40% GM: $${fmt(sell40, 3)} / BF
50% GM: $${fmt(sell50, 3)} / BF
60% GM: $${fmt(sell60, 3)} / BF`,
  );
}

export function generateWallInputs() {
  const count = parseInt($("sfWallCount")?.value || "0", 10);
  const container = $("sfWallsContainer");
  if (!container) return;

  if (!Number.isFinite(count) || count <= 0) {
    container.innerHTML = `<p class="note">Enter a valid wall count first.</p>`;
    return;
  }

  let html = `<div class="grid-2">`;
  for (let i = 1; i <= count; i++) {
    html += `
      <label>Wall ${i} Length (ft)
        <input type="number" step="0.01" min="0" id="sfWallLen_${i}" placeholder="e.g. 24" />
      </label>
      <label>Wall ${i} Height (ft)
        <input type="number" step="0.01" min="0" id="sfWallHgt_${i}" placeholder="e.g. 10" />
      </label>
    `;
  }
  html += `</div>`;
  container.innerHTML = html;
}

function calcWallGrossSqft() {
  const count = parseInt($("sfWallCount")?.value || "0", 10);
  if (!Number.isFinite(count) || count <= 0) return 0;

  let total = 0;
  for (let i = 1; i <= count; i++) {
    const L = Number.parseFloat($(`sfWallLen_${i}`)?.value || "0");
    const H = Number.parseFloat($(`sfWallHgt_${i}`)?.value || "0");
    total += (Number.isFinite(L) ? L : 0) * (Number.isFinite(H) ? H : 0);
  }
  return total;
}

export function calcSprayFullJobEstimate() {
  // Walls (dynamic)
  const wallGrossSqft = calcWallGrossSqft();
  const wallOpeningsSqft = toNum("sfOpeningsSqft");
  const wallNetSqft = Math.max(0, wallGrossSqft - wallOpeningsSqft);
  const wallThicknessIn = toNum("sfWallThickness");
  const wallFoam = $("sfWallFoam")?.value || "OC";
  const wallBF = wallNetSqft * wallThicknessIn;

  // Roof
  const roofL = toNum("sfRoofL");
  const roofW = toNum("sfRoofW");
  const pitchMult = Number.parseFloat($("sfPitchMult")?.value || "1");
  const roofSqft = roofL * roofW * (Number.isFinite(pitchMult) ? pitchMult : 1);
  const roofThicknessIn = toNum("sfRoofThickness");
  const roofFoam = $("sfRoofFoam")?.value || "OC";
  const roofBF = roofSqft * roofThicknessIn;

  // Gables (optional)
  const gableBase = toNum("sfGableBase");
  const gableHeight = toNum("sfGableHeight");
  const gableCount = toNum("sfGableCount");
  const gableSqft = 0.5 * gableBase * gableHeight * gableCount;
  const gableThicknessIn = toNum("sfGableThickness");
  const gableFoam = $("sfGableFoam")?.value || "OC";
  const gableBF = gableSqft * gableThicknessIn;

  // Linear / rim (optional)
  const linearFt = toNum("sfLinearFt");
  const linearHeight = toNum("sfLinearHeight");
  const linearSqft = linearFt * linearHeight;
  const linearThicknessIn = toNum("sfLinearThickness");
  const linearFoam = $("sfLinearFoam")?.value || "OC";
  const linearBF = linearSqft * linearThicknessIn;

  // Rollups by foam type
  let ocBF = 0;
  let ccBF = 0;

  const addBF = (foamType, bf) => {
    if (bf <= 0) return;
    if (foamType === "CC") ccBF += bf;
    else ocBF += bf;
  };

  addBF(wallFoam, wallBF);
  addBF(roofFoam, roofBF);
  addBF(gableFoam, gableBF);
  addBF(linearFoam, linearBF);

  // Adjusters
  const ocFrame = toNum("sfOcFramePct") / 100;
  const ocWaste = toNum("sfOcWastePct") / 100;
  const ccFrame = toNum("sfCcFramePct") / 100;
  const ccWaste = toNum("sfCcWastePct") / 100;

  const ocAdjBF = ocBF * (1 + ocFrame + ocWaste);
  const ccAdjBF = ccBF * (1 + ccFrame + ccWaste);

  // Fixed material costs
  const materialCost = ocAdjBF * OC_COST_PER_BF + ccAdjBF * CC_COST_PER_BF;

  // Labor + extras
  const helpers = toNum("sfHelpers");
  const hours = toNum("sfHours");
  const loadedRate = toNum("sfLoadedRate");
  const laborCost = helpers * hours * loadedRate;
  const fuelCost = toNum("sfFuel");
  const consumablesCost = toNum("sfConsumables");

  const totalCost = materialCost + laborCost + fuelCost + consumablesCost;

  const targetMarginPct = toNum("sfTargetMargin");
  if (targetMarginPct <= 0 || targetMarginPct >= 100) {
    setText("sfFullJobResults", "Target Margin must be between 1 and 99.");
    return;
  }

  const sellPrice = totalCost / (1 - targetMarginPct / 100);

  setText(
    "sfFullJobResults",
    `OC Adjusted BF: ${fmt(ocAdjBF, 0)}
CC Adjusted BF: ${fmt(ccAdjBF, 0)}

Material Cost: ${money(materialCost)}
Labor Cost: ${money(laborCost)}
Fuel: ${money(fuelCost)}
Consumables: ${money(consumablesCost)}
Total Cost: ${money(totalCost)}

Target Margin: ${fmt(targetMarginPct, 1)}%
Recommended Sell Price: ${money(sellPrice)}`,
  );
}

export function initSprayFoamWallAutogen() {
  const countInput = $("sfWallCount");
  const container = $("sfWallsContainer");
  if (!countInput || !container) return;

  const render = () => {
    const raw = countInput.value?.trim() || "";
    if (!raw) {
      container.innerHTML = `<p class="note">Enter wall count to generate L × H inputs.</p>`;
      return;
    }
    generateWallInputs();
  };

  // live update while typing + on blur/change
  countInput.addEventListener("input", render);
  countInput.addEventListener("change", render);
  countInput.addEventListener("blur", render);

  // run once on load in case value already exists (browser autofill/back nav)
  render();
}
