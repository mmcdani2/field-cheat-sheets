import { $, toNum, fmt, money, setText } from "../core.js";

export function calcYieldTracker() {
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

export function calcCostPerBF() {
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

export function calcGrossMargin() {
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

export function calcRepairQuote() {
  const type =
    document.getElementById("rqRepairType")?.value?.trim() || "Repair";
  const partCost =
    Number.parseFloat(document.getElementById("rqPartCost")?.value || "0") || 0;
  const laborHrs =
    Number.parseFloat(document.getElementById("rqLaborHours")?.value || "0") ||
    0;
  const out = document.getElementById("rqResults");
  if (!out) return;

  const LOADED_LABOR_RATE = 40;
  const TARGET_MARGIN_PCT = 40;
  const MIN_TICKET = 125;

  if (partCost < 0 || laborHrs < 0) {
    out.textContent = "Part Cost and Labor Hours cannot be negative.";
    return;
  }
  if (partCost === 0 && laborHrs === 0) {
    out.textContent = "Enter Part Cost and/or Labor Hours.";
    return;
  }

  const laborCost = laborHrs * LOADED_LABOR_RATE;
  const totalCost = partCost + laborCost;
  const rawSell = totalCost / (1 - TARGET_MARGIN_PCT / 100);
  const sell = Math.max(rawSell, MIN_TICKET);

  const gp = sell - totalCost;
  const gm = sell > 0 ? (gp / sell) * 100 : 0;

  out.textContent = `Repair Type: ${type}

Recommended Sell Price: $${sell.toFixed(2)}

Gross Profit: $${gp.toFixed(2)}
Gross Margin: ${gm.toFixed(1)}%`;
}

// hvac-calculators.js
export function toggleDuctFields() {
  const needed = document.getElementById("reDuctNeeded")?.value === "yes";
  const feetWrap = document.getElementById("reDuctFeetWrap");
  const rateWrap = document.getElementById("reDuctRateWrap");
  if (feetWrap) feetWrap.style.display = needed ? "block" : "none";
  if (rateWrap) rateWrap.style.display = needed ? "block" : "none";
}

export function calcReplacementEstimate() {
  const out = document.getElementById("reResults");
  if (!out) return;

  const toNum = (id) => {
    const v = Number.parseFloat(document.getElementById(id)?.value || "0");
    return Number.isFinite(v) ? v : 0;
  };
  const money = (n) => `$${Number(n).toFixed(2)}`;

  // Inputs
  const tons = toNum("reTons");
  const equip = toNum("reEquipCost");
  const laborHrs = toNum("reLaborHours");
  const misc = toNum("reMiscCost");
  const targetInput = toNum("reTargetMargin");

  const ductNeeded = document.getElementById("reDuctNeeded")?.value === "yes";
  const ductFeet = toNum("reDuctFeet");
  const ductRate = toNum("reDuctRate");

  // Fixed policy
  const LOADED_LABOR_RATE = 40;

  // Validation
  if (tons <= 0) {
    out.textContent = "System Capacity (tons) must be greater than 0.";
    return;
  }
  if (equip <= 0) {
    out.textContent = "Equipment Cost must be greater than 0.";
    return;
  }
  if (laborHrs < 0 || misc < 0) {
    out.textContent = "Labor Hours and Materials/Misc cannot be negative.";
    return;
  }
  if (ductNeeded && ductFeet <= 0) {
    out.textContent = "Enter Duct Linear Feet when duct work is set to Yes.";
    return;
  }
  if (ductNeeded && ductRate <= 0) {
    out.textContent = "Enter a valid Duct Price per Foot.";
    return;
  }

  const targetMargin = Math.min(Math.max(targetInput || 40, 1), 95);

  // Cost build (hidden from UI)
  const laborCost = laborHrs * LOADED_LABOR_RATE;
  const ductCost = ductNeeded ? ductFeet * ductRate : 0;
  const totalCost = equip + laborCost + misc + ductCost;

  // Sell price by margin formula
  const rawSell = totalCost / (1 - targetMargin / 100);
  const sell = Math.ceil(rawSell / 50) * 50; // round up to clean quote

  out.textContent = `Recommended Sell Price: ${money(sell)}

Disclaimer: Budgetary estimate only. Final pricing is subject to confirmed load calculation, field measurements, equipment match, duct design/scope, code requirements, and full install conditions.`;
}

export function checkCommissioningGate() {
  const checks = [
    "ccThermostat","ccFilter","ccDrain","ccStatic","ccSHSC",
    "ccDeltaT","ccAmpsVolts","ccPhotos","ccCustomerWalk"
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

export function checkInstallPreparedness() {
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
  const done = ids.filter((id) => $(id)?.checked).length;
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
