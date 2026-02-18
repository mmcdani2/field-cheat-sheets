import {
  calcGrossMargin,
  calcRepairQuote,
  calcReplacementEstimate,
  checkCommissioningGate,
  checkInstallPreparedness,
  toggleDuctFields,
} from "./hvac/hvac-calculators.js";

import {
  calcYieldTracker,
  calcCostPerBF,
  calcSprayFullJobEstimate,
  generateWallInputs,
} from "./spray-foam/spray-foam-calculator.js";

import { submitRefrigerantLog } from "./hvac/hvac-refrigerant.js";

// expose for inline onclick
window.calcYieldTracker = calcYieldTracker;
window.calcCostPerBF = calcCostPerBF;
window.calcSprayFullJobEstimate = calcSprayFullJobEstimate;
window.generateWallInputs = generateWallInputs;

window.calcGrossMargin = calcGrossMargin;
window.calcRepairQuote = calcRepairQuote;
window.calcReplacementEstimate = calcReplacementEstimate;
window.checkCommissioningGate = checkCommissioningGate;
window.checkInstallPreparedness = checkInstallPreparedness;
window.submitRefrigerantLog = submitRefrigerantLog;
window.toggleDuctFields = toggleDuctFields;
