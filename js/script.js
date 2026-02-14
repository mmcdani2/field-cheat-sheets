"use strict";

/* =========================
   Core helpers
   ========================= */
const $ = (id) => document.getElementById(id);

function toNum(id) {
  const el = $(id);
  if (!el) return 0;
  const v = Number.parseFloat(el.value);
  return Number.isFinite(v) ? v : 0;
}

function fmt(n, d = 2) {
  return Number(n).toFixed(d);
}

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

/* =========================
   Accordion (one-open-at-a-time)
   ========================= */
document.addEventListener("DOMContentLoaded", () => {
  const groups = document.querySelectorAll("[data-accordion]");

  groups.forEach((group) => {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest(".acc-trigger");
      if (!btn) return;

      const item = btn.closest(".acc-item");
      if (!item) return;

      const alreadyOpen = item.classList.contains("open");
      group.querySelectorAll(".acc-item.open").forEach((i) => i.classList.remove("open"));
      if (!alreadyOpen) item.classList.add("open");
    });
  });
});

/* =========================
   Existing Spray Foam calculators
   (kept for cross-page compatibility)
   ========================= */
function calcYieldTracker() {
  const area = toNum("areaSqft");
  const thickness = toNum("thicknessIn");
  const sets = toNum("setsUsed");
  const theoretical = toNum("theoreticalSetYield") || 4000;

  const outId = "yieldResults";
  if (!$(outId)) return;

  if (area <= 0 || thickness <= 0 || sets <= 0) {
    setText(outId, "Please enter valid Area, Thickness, and Sets Used.");
    return;
  }

  const installedBF = area * thickness;
  const actualYieldSet = installedBF / sets;
  const theoreticalTotal = sets * theoretical;
  const eff = (actualYieldSet / theoretical) * 100;
  const waste = 100 - eff;
  const shortfall = theoreticalTotal - installedBF;

  setText(
    outId,
`Installed BF: ${fmt(installedBF, 0)} BF
Actual Yield per Set: ${fmt(actualYieldSet, 0)} BF/set
Theoretical Total BF: ${fmt(theoreticalTotal, 0)} BF
Yield Efficiency: ${fmt(eff, 1)}%
Implied Waste/Loss vs Theoretical: ${fmt(waste, 1)}%
BF Shortfall vs Theoretical: ${fmt(shortfall, 0)} BF`
  );
}

function calcCostPerBF() {
  const setCost = toNum("setCost");
  const expectedYield = toNum("expectedYield");

  const outId = "costResults";
  if (!$(outId)) return;

  if (setCost <= 0 || expectedYield <= 0) {
    setText(outId, "Please enter valid Set Cost and Expected Yield.");
    return;
  }

  const cost = setCost / expectedYield;
  const sell40 = cost / 0.6;
  const sell50 = cost / 0.5;
  const sell60 = cost / 0.4;

  setText(
    outId,
`Cost per BF: $${fmt(cost, 3)}

Suggested Sell Price Targets:
40% GM: $${fmt(sell40, 3)} / BF
50% GM: $${fmt(sell50, 3)} / BF
60% GM: $${fmt(sell60, 3)} / BF`
  );
}

/* =========================
   HVAC: Gross Margin Snapshot
   ========================= */
function calcGrossMargin() {
  const sell = toNum("gmSellPrice");
  const mat = toNum("gmMaterialCost");
  const hrs = toNum("gmLaborHours");
  const rate = toNum("gmLaborRate");
  const other = toNum("gmOtherCost");
  const targetPct = toNum("gmTargetMargin");

  const outId = "gmResults";
  if (!$(outId)) return;

  if (sell <= 0) {
    setText(outId, "Sell Price must be greater than 0.");
    return;
  }

  const labor = hrs * rate;
  const totalCost = mat + labor + other;
  const gp = sell - totalCost;
  const gmPct = (gp / sell) * 100;
  const pass = gmPct >= targetPct;

  setText(
    outId,
`Revenue: ${money(sell)}
Material: ${money(mat)}
Labor (${fmt(hrs, 2)}h @ ${money(rate)}/h): ${money(labor)}
Other Costs: ${money(other)}
Total Cost: ${money(totalCost)}

Gross Profit: ${money(gp)}
Gross Margin: ${fmt(gmPct, 1)}%
Target Margin: ${fmt(targetPct, 1)}%
Status: ${pass ? "PASS ✅" : "BELOW TARGET ⚠️"}`
  );
}

/* =========================
   HVAC: Repair Quote Builder
   ========================= */
function calcRepairQuote() {
  const type = $("rqRepairType")?.value || "Repair";
  const partCost = toNum("rqPartCost");
  const laborHrs = toNum("rqLaborHours");

  const outId = "rqResults";
  if (!$(outId)) return;

  if (partCost < 0 || laborHrs < 0) {
    setText(outId, "Inputs cannot be negative.");
    return;
  }

  if (partCost === 0 && laborHrs === 0) {
    setText(outId, "Enter at least Part Cost or Labor Hours.");
    return;
  }

  // Fixed policy values
  const LOADED_LABOR_RATE = 40;  // hidden
  const TARGET_MARGIN_PCT = 40;  // hidden
  const MIN_TICKET = 125;        // hard floor

  const laborCost = laborHrs * LOADED_LABOR_RATE;
  const totalCost = partCost + laborCost;

  // Target sell from margin formula
  const rawSell = totalCost / (1 - TARGET_MARGIN_PCT / 100);

  // Enforce minimum ticket
  const finalSell = Math.max(rawSell, MIN_TICKET);

  const gp = finalSell - totalCost;
  const gm = finalSell > 0 ? (gp / finalSell) * 100 : 0;

  setText(
    outId,
`Repair Type: ${type}

Part Cost: ${money(partCost)}
Labor Cost: ${money(laborCost)}
Total Cost Basis: ${money(totalCost)}

Target Margin: 40%
Minimum Ticket: $125.00

Recommended Sell Price: ${money(finalSell)}

Gross Profit: ${money(gp)}
Gross Margin: ${fmt(gm, 1)}%`
  );
}


/* =========================
   HVAC: Replacement Estimator
   ========================= */
function calcReplacementEstimate() {
  const tons = toNum("reTons");
  const tier = $("reTier")?.value || "good";
  const duct = $("reDuctScope")?.value || "none";
  const mult = toNum("reComplexityMult") || 1;
  const accessories = toNum("reAccessoryCost");
  const targetPct = toNum("reTargetMargin");

  const outId = "reResults";
  if (!$(outId)) return;

  if (tons <= 0) {
    setText(outId, "System Capacity (tons) must be greater than 0.");
    return;
  }

  // Cost baselines per ton (editable assumptions)
  const tierCostPerTon = {
    good: 1800,
    better: 2300,
    best: 2900
  };

  // Duct scope cost adders
  const ductAdder = {
    none: 0,
    partial: 1800,
    full: 4500
  };

  const baseEquipCost = tons * (tierCostPerTon[tier] || tierCostPerTon.good);
  const rawCost = (baseEquipCost + (ductAdder[duct] || 0) + accessories) * mult;

  const safeTarget = Math.min(Math.max(targetPct, 1), 95);
  const targetSell = rawCost / (1 - safeTarget / 100);

  // Budgetary range
  const low = targetSell * 0.93;
  const high = targetSell * 1.12;

  setText(
    outId,
`Inputs:
Capacity: ${fmt(tons, 1)} tons
Tier: ${tier.toUpperCase()}
Duct Scope: ${duct}
Complexity Multiplier: ${fmt(mult, 2)}
Accessories: ${money(accessories)}
Target Margin: ${fmt(targetPct, 1)}%

Estimated Internal Cost Basis: ${money(rawCost)}

Budgetary Sell Range:
LOW: ${money(low)}
TARGET: ${money(targetSell)}
HIGH: ${money(high)}`
  );
}

/* =========================
   HVAC: Commissioning Closeout Gate
   ========================= */
function checkCommissioningGate() {
  const checks = [
    "ccThermostat",
    "ccFilter",
    "ccDrain",
    "ccStatic",
    "ccSHSC",
    "ccDeltaT",
    "ccAmpsVolts",
    "ccPhotos",
    "ccCustomerWalk"
  ];

  const outId = "ccResults";
  if (!$(outId)) return;

  const missing = checks.filter((id) => !($(id)?.checked));

  if (missing.length === 0) {
    setText(outId, "Closeout Status: READY TO CLOSE ✅\nAll commissioning checkpoints are complete.");
    return;
  }

  setText(
    outId,
`Closeout Status: NOT READY ⚠️
Missing ${missing.length} required checkpoint(s):
- ${missing.join("\n- ")}`
  );
}

/* =========================
   Expose for inline onclick handlers
   ========================= */
window.calcYieldTracker = calcYieldTracker;
window.calcCostPerBF = calcCostPerBF;
window.calcGrossMargin = calcGrossMargin;
window.calcRepairQuote = calcRepairQuote;
window.calcReplacementEstimate = calcReplacementEstimate;
window.checkCommissioningGate = checkCommissioningGate;

function checkInstallPreparedness() {
  const ids = [
    "ipScope1","ipScope2","ipScope3","ipScope4",
    "ipMat1","ipMat2","ipMat3","ipMat4","ipMat5","ipMat6","ipMat7",
    "ipLog1","ipLog2","ipLog3","ipLog4","ipLog5",
    "ipTool1","ipTool2","ipTool3","ipTool4","ipTool5",
    "ipClose1","ipClose2","ipClose3","ipClose4"
  ];

  const out = $("ipResults");
  if (!out) return;

  const total = ids.length;
  const done = ids.filter(id => $(id)?.checked).length;
  const missing = total - done;
  const pct = (done / total) * 100;

  let status = "NOT READY ❌";
  if (pct >= 100) status = "READY TO DISPATCH ✅";
  else if (pct >= 85) status = "NEAR READY ⚠️";

  out.textContent =
`Preparedness: ${done}/${total} (${pct.toFixed(0)}%)
Status: ${status}
Missing Items: ${missing}`;
}
window.checkInstallPreparedness = checkInstallPreparedness;

async function submitRefrigerantLog() {
  const out = $("refLogResult");
  if (!out) return;

  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxXQMKS7z9XqZNUGBCAMiE12YgNnq0w-ZjjZ_vcv-X0q5URtFgc3JvRWKJeVAificqx/exec";

  const payload = {
    tech: $("refTech")?.value?.trim() || "",
    jobNumber: $("refJobNumber")?.value?.trim() || "",
    customer: $("refCustomer")?.value?.trim() || "",
    city: $("refCity")?.value?.trim() || "",
    equipmentType: $("refEquipmentType")?.value || "",
    refrigerantType: $("refRefrigerantType")?.value || "",
    poundsAdded: toNum("refPoundsAdded"),
    poundsRecovered: toNum("refPoundsRecovered"),
    leakSuspected: $("refLeakSuspected")?.value || "No",
    notes: $("refNotes")?.value?.trim() || ""
  };

  // Minimal validation
  if (!payload.tech || !payload.jobNumber || !payload.refrigerantType) {
    out.textContent = "Tech, Job #, and Refrigerant Type are required.";
    return;
  }

  try {
    out.textContent = "Submitting...";

    const res = await fetch(WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.ok) {
      out.textContent = `Submit failed: ${data.error || "Unknown error"}`;
      return;
    }

    out.textContent = "Log submitted successfully ✅";

    // Optional clear
    [
      "refTech","refJobNumber","refCustomer","refCity","refNotes"
    ].forEach(id => { const el = $(id); if (el) el.value = ""; });

    ["refEquipmentType","refRefrigerantType","refLeakSuspected"].forEach(id => {
      const el = $(id);
      if (el) el.selectedIndex = 0;
    });

    ["refPoundsAdded","refPoundsRecovered"].forEach(id => {
      const el = $(id);
      if (el) el.value = "";
    });

  } catch (err) {
    out.textContent = `Network/error: ${String(err)}`;
  }
}

window.submitRefrigerantLog = submitRefrigerantLog;
