import {
  byId,
  clearStatus,
  createWizard,
  showError,
  showStatus,
} from "../core.js";
import { STATES } from "../data/states.js";

const DRAFT_KEY = "fieldRef.hvacServiceChecklistDraft";
const STEP_KEY = "fieldRef.hvacServiceChecklistStep";

const steps = Array.from(document.querySelectorAll(".wizard-step"));
const progressEl = byId("wizardProgress");
const stepTextEl = byId("wizardStepText");
const nextBtn = byId("nextBtn");
const backBtn = byId("backBtn");
const errorBox = byId("wizardError");
const statusBox = byId("wizardStatus");

const formEl = byId("serviceChecklistForm");
const formScreen = byId("formScreen");
const submitSuccessScreen = byId("submitSuccessScreen");
const submitSuccessSummary = byId("submitSuccessSummary");
const newChecklistBtn = byId("newChecklistBtn");

const jobSummaryBar = byId("jobSummaryBar");
const jobSummaryText = byId("jobSummaryText");
const customerReportPreview = byId("customerReportPreview");
const printReportBtn = byId("printReportBtn");

let wizard = null;

function getText(id) {
  return byId(id)?.value?.trim() || "";
}

function saveCurrentStep(stepIndex) {
  localStorage.setItem(STEP_KEY, String(stepIndex));
}

function loadCurrentStep() {
  const raw = localStorage.getItem(STEP_KEY);
  const step = Number.parseInt(raw ?? "0", 10);
  if (!Number.isInteger(step)) return 0;
  if (step < 0 || step > steps.length - 1) return 0;
  return step;
}

function clearCurrentStep() {
  localStorage.removeItem(STEP_KEY);
}

function setDefaultDateIfEmpty() {
  const dateEl = byId("svcDate");
  if (!dateEl || dateEl.value) return;

  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  dateEl.value = local.toISOString().slice(0, 10);
}

function populateStateOptions() {
  const stateEl = byId("svcState");
  if (!stateEl) return;

  const current = stateEl.value;

  stateEl.innerHTML = `
    <option value="">Select</option>
    ${STATES.map(
      (state) =>
        `<option value="${state.code}">${state.code} — ${state.name}</option>`,
    ).join("")}
  `;

  if (current) {
    stateEl.value = current;
  } else {
    stateEl.value = "TX";
  }
}

function setSegmentButtonState(selector, hiddenInputId, activeClasses) {
  const buttons = Array.from(document.querySelectorAll(selector));
  const hiddenInput = byId(hiddenInputId);
  const selectedValue = hiddenInput?.value || "";

  buttons.forEach((btn) => {
    const active = btn.dataset.value === selectedValue;
    btn.className = active ? activeClasses : btn.dataset.baseClass;
  });
}

function bindSegmentedButtons() {
  const checklistBtns = Array.from(
    document.querySelectorAll(".checklistTypeBtn"),
  );
  const statusBtns = Array.from(document.querySelectorAll(".overallStatusBtn"));

  checklistBtns.forEach((btn) => {
    btn.dataset.baseClass =
      "checklistTypeBtn rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4 text-left text-base font-bold text-white transition active:scale-[0.98]";

    btn.addEventListener("click", () => {
      const hiddenInput = byId("svcChecklistType");
      if (!hiddenInput) return;
      hiddenInput.value = btn.dataset.value || "";
      setSegmentButtonState(
        ".checklistTypeBtn",
        "svcChecklistType",
        "checklistTypeBtn rounded-2xl border border-[#e5621c]/30 bg-[#e5621c]/15 px-4 py-4 text-left text-base font-bold text-[#e5621c] transition active:scale-[0.98]",
      );
      saveDraft();
      updateJobSummary();
      renderCustomerReportPreview();
    });
  });

  statusBtns.forEach((btn) => {
    btn.dataset.baseClass =
      "overallStatusBtn rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4 text-left text-base font-bold text-white transition active:scale-[0.98]";

    btn.addEventListener("click", () => {
      const hiddenInput = byId("svcOverallStatus");
      if (!hiddenInput) return;
      hiddenInput.value = btn.dataset.value || "";
      setSegmentButtonState(
        ".overallStatusBtn",
        "svcOverallStatus",
        "overallStatusBtn rounded-2xl border border-[#e5621c]/30 bg-[#e5621c]/15 px-4 py-4 text-left text-base font-bold text-[#e5621c] transition active:scale-[0.98]",
      );
      saveDraft();
      renderCustomerReportPreview();
    });
  });

  setSegmentButtonState(
    ".checklistTypeBtn",
    "svcChecklistType",
    "checklistTypeBtn rounded-2xl border border-[#e5621c]/30 bg-[#e5621c]/15 px-4 py-4 text-left text-base font-bold text-[#e5621c] transition active:scale-[0.98]",
  );

  setSegmentButtonState(
    ".overallStatusBtn",
    "svcOverallStatus",
    "overallStatusBtn rounded-2xl border border-[#e5621c]/30 bg-[#e5621c]/15 px-4 py-4 text-left text-base font-bold text-[#e5621c] transition active:scale-[0.98]",
  );
}

function getPayload() {
  return {
    date: getText("svcDate"),
    jobNumber: getText("svcJobNumber"),
    customerName: getText("svcCustomerName"),
    address: getText("svcAddress"),
    city: getText("svcCity"),
    state: getText("svcState"),
    tech: getText("svcTech"),

    checklistType: getText("svcChecklistType"),
    systemType: getText("svcSystemType"),
    equipmentBrand: getText("svcEquipmentBrand"),
    tonnage: getText("svcTonnage"),
    equipmentModel: getText("svcEquipmentModel"),

    filterCondition: getText("svcFilterCondition"),
    drainCondition: getText("svcDrainCondition"),
    electricalCondition: getText("svcElectricalCondition"),
    airflowCondition: getText("svcAirflowCondition"),
    outdoorCondition: getText("svcOutdoorCondition"),
    performanceCondition: getText("svcPerformanceCondition"),

    overallStatus: getText("svcOverallStatus"),
    findingsSummary: getText("svcFindingsSummary"),
    recommendedActions: getText("svcRecommendedActions"),
    customerNotes: getText("svcCustomerNotes"),
  };
}

function getDraftData() {
  return {
    svcDate: byId("svcDate")?.value ?? "",
    svcJobNumber: byId("svcJobNumber")?.value ?? "",
    svcCustomerName: byId("svcCustomerName")?.value ?? "",
    svcAddress: byId("svcAddress")?.value ?? "",
    svcCity: byId("svcCity")?.value ?? "",
    svcState: byId("svcState")?.value ?? "",
    svcTech: byId("svcTech")?.value ?? "",
    svcChecklistType: byId("svcChecklistType")?.value ?? "",
    svcSystemType: byId("svcSystemType")?.value ?? "",
    svcEquipmentBrand: byId("svcEquipmentBrand")?.value ?? "",
    svcTonnage: byId("svcTonnage")?.value ?? "",
    svcEquipmentModel: byId("svcEquipmentModel")?.value ?? "",
    svcFilterCondition: byId("svcFilterCondition")?.value ?? "",
    svcDrainCondition: byId("svcDrainCondition")?.value ?? "",
    svcElectricalCondition: byId("svcElectricalCondition")?.value ?? "",
    svcAirflowCondition: byId("svcAirflowCondition")?.value ?? "",
    svcOutdoorCondition: byId("svcOutdoorCondition")?.value ?? "",
    svcPerformanceCondition: byId("svcPerformanceCondition")?.value ?? "",
    svcOverallStatus: byId("svcOverallStatus")?.value ?? "",
    svcFindingsSummary: byId("svcFindingsSummary")?.value ?? "",
    svcRecommendedActions: byId("svcRecommendedActions")?.value ?? "",
    svcCustomerNotes: byId("svcCustomerNotes")?.value ?? "",
  };
}

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(getDraftData()));
}

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;

  try {
    const draft = JSON.parse(raw);

    const ids = [
      "svcDate",
      "svcJobNumber",
      "svcCustomerName",
      "svcAddress",
      "svcCity",
      "svcState",
      "svcTech",
      "svcChecklistType",
      "svcSystemType",
      "svcEquipmentBrand",
      "svcTonnage",
      "svcEquipmentModel",
      "svcFilterCondition",
      "svcDrainCondition",
      "svcElectricalCondition",
      "svcAirflowCondition",
      "svcOutdoorCondition",
      "svcPerformanceCondition",
      "svcOverallStatus",
      "svcFindingsSummary",
      "svcRecommendedActions",
      "svcCustomerNotes",
    ];

    ids.forEach((id) => {
      const el = byId(id);
      if (!el) return;
      el.value = draft[id] ?? "";
    });
  } catch (err) {
    console.error("Failed to load service checklist draft:", err);
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function updateJobSummary() {
  if (!jobSummaryBar || !jobSummaryText || !wizard) return;

  const step = wizard.getCurrentStep();
  const jobNumber = getText("svcJobNumber");
  const customer = getText("svcCustomerName");
  const city = getText("svcCity");
  const state = getText("svcState");
  const type = getText("svcChecklistType");

  const parts = [
    jobNumber ? `#${jobNumber}` : "",
    customer,
    city && state ? `${city}, ${state}` : city || state || "",
    type,
  ].filter(Boolean);

  const shouldShow = step > 0 && parts.length > 0;
  jobSummaryBar.classList.toggle("hidden", !shouldShow);
  jobSummaryText.textContent = shouldShow ? parts.join(" • ") : "—";
}

function renderCustomerReportPreview() {
  if (!customerReportPreview) return;

  const p = getPayload();

  const inspectionRows = [
    ["Filter Condition", p.filterCondition || "—"],
    ["Drain / Condensate", p.drainCondition || "—"],
    ["Electrical Components", p.electricalCondition || "—"],
    ["Blower / Airflow", p.airflowCondition || "—"],
    ["Outdoor Coil / Condenser", p.outdoorCondition || "—"],
    ["Refrigerant / Performance", p.performanceCondition || "—"],
  ];

  customerReportPreview.innerHTML = `
    <div class="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3">
      <div class="text-xs uppercase tracking-wide text-white/45">Customer / Site</div>
      <div class="mt-1 text-sm font-medium text-white">${p.customerName || "—"}</div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3">
        <div class="text-xs uppercase tracking-wide text-white/45">Service Type</div>
        <div class="mt-1 text-sm font-medium text-white">${p.checklistType || "—"}</div>
      </div>

      <div class="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3">
        <div class="text-xs uppercase tracking-wide text-white/45">Overall Status</div>
        <div class="mt-1 text-sm font-medium text-white">${p.overallStatus || "—"}</div>
      </div>
    </div>

    <div class="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3">
      <div class="text-xs uppercase tracking-wide text-white/45">System</div>
      <div class="mt-1 text-sm font-medium text-white">
        ${[p.systemType, p.equipmentBrand, p.tonnage, p.equipmentModel].filter(Boolean).join(" • ") || "—"}
      </div>
    </div>

    <div class="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3">
      <div class="text-xs uppercase tracking-wide text-white/45">Inspection Results</div>
      <div class="mt-3 space-y-2">
        ${inspectionRows
          .map(
            ([label, value]) => `
              <div class="flex items-center justify-between gap-3 border-b border-white/5 pb-2 last:border-b-0 last:pb-0">
                <span class="text-sm text-white/70">${label}</span>
                <span class="text-sm font-medium text-white">${value}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>

    <div class="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3">
      <div class="text-xs uppercase tracking-wide text-white/45">Findings Summary</div>
      <div class="mt-1 text-sm font-medium text-white whitespace-pre-wrap">${p.findingsSummary || "—"}</div>
    </div>

    <div class="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3">
      <div class="text-xs uppercase tracking-wide text-white/45">Recommended Actions</div>
      <div class="mt-1 text-sm font-medium text-white whitespace-pre-wrap">${p.recommendedActions || "—"}</div>
    </div>

    <div class="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3">
      <div class="text-xs uppercase tracking-wide text-white/45">Customer Notes</div>
      <div class="mt-1 text-sm font-medium text-white whitespace-pre-wrap">${p.customerNotes || "—"}</div>
    </div>
  `;
}

function showSubmitSuccess() {
  const p = getPayload();

  formScreen?.classList.add("hidden");
  submitSuccessScreen?.classList.remove("hidden");

  if (!submitSuccessSummary) return;

  submitSuccessSummary.innerHTML = `
    <div class="rounded-xl border border-white/10 bg-neutral-950/40 px-4 py-3">
      <div class="text-xs uppercase tracking-wide text-white/45">Job #</div>
      <div class="mt-1 font-medium text-white">${p.jobNumber || "—"}</div>
    </div>

    <div class="rounded-xl border border-white/10 bg-neutral-950/40 px-4 py-3">
      <div class="text-xs uppercase tracking-wide text-white/45">Customer / Site</div>
      <div class="mt-1 font-medium text-white">${p.customerName || "—"}</div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-xl border border-white/10 bg-neutral-950/40 px-4 py-3">
        <div class="text-xs uppercase tracking-wide text-white/45">Service Type</div>
        <div class="mt-1 font-medium text-white">${p.checklistType || "—"}</div>
      </div>

      <div class="rounded-xl border border-white/10 bg-neutral-950/40 px-4 py-3">
        <div class="text-xs uppercase tracking-wide text-white/45">Overall Status</div>
        <div class="mt-1 font-medium text-white">${p.overallStatus || "—"}</div>
      </div>
    </div>
  `;
}

function hideSubmitSuccess() {
  formScreen?.classList.remove("hidden");
  submitSuccessScreen?.classList.add("hidden");
  if (submitSuccessSummary) submitSuccessSummary.innerHTML = "";
}

function resetFormUi() {
  formEl?.reset();
  clearDraft();
  clearCurrentStep();
  hideSubmitSuccess();
  populateStateOptions();
  setDefaultDateIfEmpty();
  bindSegmentedButtons();
  wizard.setCurrentStep(0);
  updateJobSummary();
  renderCustomerReportPreview();
}

function validateStep(stepIndex) {
  if (stepIndex === 0) {
    if (!getText("svcDate"))
      return showStepError("Date is required.", "svcDate");
    if (!getText("svcJobNumber"))
      return showStepError("Job # is required.", "svcJobNumber");
    if (!getText("svcCustomerName")) {
      return showStepError(
        "Customer / Site Name is required.",
        "svcCustomerName",
      );
    }
    if (!getText("svcAddress"))
      return showStepError("Address is required.", "svcAddress");
    if (!getText("svcCity"))
      return showStepError("City is required.", "svcCity");
    if (!getText("svcState"))
      return showStepError("State is required.", "svcState");
    if (!getText("svcTech"))
      return showStepError("Tech is required.", "svcTech");
    return true;
  }

  if (stepIndex === 1) {
    if (!getText("svcChecklistType")) {
      return showStepError("Service Type is required.", "svcChecklistType");
    }
    if (!getText("svcSystemType")) {
      return showStepError("System Type is required.", "svcSystemType");
    }
    return true;
  }

  if (stepIndex === 2) {
    if (!getText("svcFilterCondition")) {
      return showStepError(
        "Filter Condition is required.",
        "svcFilterCondition",
      );
    }
    if (!getText("svcDrainCondition")) {
      return showStepError(
        "Drain / Condensate is required.",
        "svcDrainCondition",
      );
    }
    if (!getText("svcElectricalCondition")) {
      return showStepError(
        "Electrical Components is required.",
        "svcElectricalCondition",
      );
    }
    if (!getText("svcAirflowCondition")) {
      return showStepError(
        "Blower / Airflow is required.",
        "svcAirflowCondition",
      );
    }
    if (!getText("svcOutdoorCondition")) {
      return showStepError(
        "Outdoor Coil / Condenser is required.",
        "svcOutdoorCondition",
      );
    }
    if (!getText("svcPerformanceCondition")) {
      return showStepError(
        "Refrigerant / Performance is required.",
        "svcPerformanceCondition",
      );
    }
    return true;
  }

  if (stepIndex === 3) {
    if (!getText("svcOverallStatus")) {
      return showStepError(
        "Overall System Status is required.",
        "svcOverallStatus",
      );
    }
    if (!getText("svcFindingsSummary")) {
      return showStepError(
        "Findings Summary is required.",
        "svcFindingsSummary",
      );
    }
    if (!getText("svcRecommendedActions")) {
      return showStepError(
        "Recommended Actions are required.",
        "svcRecommendedActions",
      );
    }
    return true;
  }

  return true;
}

function showStepError(message, id) {
  showError(errorBox, message);
  byId(id)?.focus?.();
  return false;
}

function bindAutosave() {
  const ids = [
    "svcDate",
    "svcJobNumber",
    "svcCustomerName",
    "svcAddress",
    "svcCity",
    "svcState",
    "svcTech",
    "svcChecklistType",
    "svcSystemType",
    "svcEquipmentBrand",
    "svcTonnage",
    "svcEquipmentModel",
    "svcFilterCondition",
    "svcDrainCondition",
    "svcElectricalCondition",
    "svcAirflowCondition",
    "svcOutdoorCondition",
    "svcPerformanceCondition",
    "svcOverallStatus",
    "svcFindingsSummary",
    "svcRecommendedActions",
    "svcCustomerNotes",
  ];

  ids.forEach((id) => {
    const el = byId(id);
    if (!el) return;
    el.addEventListener("input", () => {
      saveDraft();
      updateJobSummary();
      renderCustomerReportPreview();
    });
    el.addEventListener("change", () => {
      saveDraft();
      updateJobSummary();
      renderCustomerReportPreview();
    });
  });
}

printReportBtn?.addEventListener("click", () => {
  window.print();
});

newChecklistBtn?.addEventListener("click", () => {
  resetFormUi();
});

wizard = createWizard({
  steps,
  progressEl,
  stepTextEl,
  nextBtn,
  backBtn,
  errorBox,
  onRenderStep: (stepIndex) => {
    saveCurrentStep(stepIndex);
    updateJobSummary();
    renderCustomerReportPreview();

    if (stepIndex === steps.length - 1) {
      nextBtn.textContent = "Finish";
    } else {
      nextBtn.textContent = "Next";
    }
  },
  onValidateStep: validateStep,
  onSubmit: () => {
    showStatus(statusBox, "Checklist ready to print.");
    showSubmitSuccess();
  },
  submitLabel: "Finish",
  nextLabel: "Next",
});

populateStateOptions();
loadDraft();
setDefaultDateIfEmpty();
bindAutosave();
bindSegmentedButtons();
wizard.setCurrentStep(loadCurrentStep());
updateJobSummary();
renderCustomerReportPreview();
saveDraft();
clearStatus(statusBox);
