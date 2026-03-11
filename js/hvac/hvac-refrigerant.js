import {
  byId,
  clearStatus,
  createWizard,
  populateSelect,
  showError,
  showStatus,
} from "../core.js";
import { STATES } from "../data/states.js";
import { REFRIGERANT_TYPES } from "../data/refrigerant-types.js";
import { SYSTEM_TYPES } from "../data/system-types.js";
import {
  flushQueue,
  getQueueCount,
  queueSubmission,
  updateQueuedSubmission,
} from "../offline-queue.js";

const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycby-mLUIwoSTYPerbvQTmA578AQYiaj0lrG--dxQMytHn3H0a90OnltOY1DWETDjYeTi/exec";

const MODULE_KEY = "refrigerant-log";
const DRAFT_KEY = "fieldRef.refrigerantLogDraft";
const STEP_KEY = "fieldRef.refrigerantLogStep";
const EDIT_QUEUE_KEY = "fieldRef.refrigerantLogEditQueueId";
const RECENT_SUBMISSIONS_URL = "../../partials/hvac/recent-submissions.html";

const steps = Array.from(document.querySelectorAll(".wizard-step"));
const progressEl = byId("wizardProgress");
const stepTextEl = byId("wizardStepText");
const nextBtn = byId("nextBtn");
const backBtn = byId("backBtn");
const errorBox = byId("wizardError");
const statusBox = byId("wizardStatus");
const formEl = byId("refWizardForm");
const reviewList = byId("reviewList");
const queueIndicator = byId("queueIndicator");
const queueIndicatorText = byId("queueIndicatorText");
const viewQueuedBtn = byId("viewQueuedBtn");
const editQueueBanner = byId("editQueueBanner");

let statusTimer = null;

function getFieldValue(id) {
  return byId(id)?.value?.trim() || "";
}

function getNum(id) {
  const raw = byId(id)?.value ?? "";
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function ouncesToDecimalPounds(lbs, oz) {
  return Number((lbs + oz / 16).toFixed(2));
}

function generateSubmissionId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function populateStates() {
  const select = byId("refState");
  if (!select) return;

  populateSelect(
    select,
    STATES.map((state) => ({
      value: state.code,
      label: state.name,
    })),
    "Select state",
  );
}

function populateSystemTypes() {
  const select = byId("refEquipmentType");
  if (!select) return;

  populateSelect(select, SYSTEM_TYPES, "Select equipment type");
}

function populateRefrigerantTypes() {
  const select = byId("refRefrigerantType");
  if (!select) return;

  populateSelect(select, REFRIGERANT_TYPES, "Select refrigerant type");
}

function getPayload() {
  const poundsAdded = ouncesToDecimalPounds(
    getNum("refAddedLbs"),
    getNum("refAddedOz"),
  );
  const poundsRecovered = ouncesToDecimalPounds(
    getNum("refRecoveredLbs"),
    getNum("refRecoveredOz"),
  );

  const existingDraft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
  const submissionId = existingDraft.submissionId || generateSubmissionId();

  return {
    submissionId,
    techName: getFieldValue("refTech"),
    jobNumber: getFieldValue("refJobNumber"),
    customerName: getFieldValue("refCustomer"),
    city: getFieldValue("refCity"),
    state: getFieldValue("refState"),
    equipmentType: getFieldValue("refEquipmentType"),
    refrigerantType: getFieldValue("refRefrigerantType"),
    poundsAdded,
    poundsRecovered,
    leakSuspected: getFieldValue("refLeakSuspected"),
    notes: getFieldValue("refNotes"),
  };
}

function getDraftData() {
  return {
    submissionId:
      JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}")?.submissionId || "",
    refTech: byId("refTech")?.value ?? "",
    refJobNumber: byId("refJobNumber")?.value ?? "",
    refCustomer: byId("refCustomer")?.value ?? "",
    refCity: byId("refCity")?.value ?? "",
    refState: byId("refState")?.value ?? "",
    refEquipmentType: byId("refEquipmentType")?.value ?? "",
    refRefrigerantType: byId("refRefrigerantType")?.value ?? "",
    refAddedLbs: byId("refAddedLbs")?.value ?? "",
    refAddedOz: byId("refAddedOz")?.value ?? "",
    refRecoveredLbs: byId("refRecoveredLbs")?.value ?? "",
    refRecoveredOz: byId("refRecoveredOz")?.value ?? "",
    refLeakSuspected: byId("refLeakSuspected")?.value ?? "",
    refNotes: byId("refNotes")?.value ?? "",
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

    Object.entries(draft).forEach(([id, value]) => {
      const el = byId(id);
      if (!el) return;
      el.value = value ?? "";
    });
  } catch (err) {
    console.error("Failed to load refrigerant draft:", err);
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function saveCurrentStep(stepIndex) {
  localStorage.setItem(STEP_KEY, String(stepIndex));
}

function loadCurrentStep() {
  const raw = localStorage.getItem(STEP_KEY);
  const step = Number.parseInt(raw ?? "0", 10);

  if (!Number.isInteger(step)) return 0;
  if (step < 0) return 0;
  if (step > steps.length - 1) return 0;

  return step;
}

function clearCurrentStep() {
  localStorage.removeItem(STEP_KEY);
}

function getEditingQueueId() {
  const raw = localStorage.getItem(EDIT_QUEUE_KEY);
  const id = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function setEditingQueueId(id) {
  localStorage.setItem(EDIT_QUEUE_KEY, String(id));
}

function clearEditingQueueId() {
  localStorage.removeItem(EDIT_QUEUE_KEY);
}

function syncEditModeUi() {
  const editingId = getEditingQueueId();

  if (editQueueBanner) {
    editQueueBanner.classList.toggle("hidden", !editingId);
  }

  if (nextBtn && wizard.getCurrentStep() === steps.length - 1) {
    nextBtn.textContent = editingId ? "Save Changes" : "Submit Log";
  }
}

function bindDraftAutosave() {
  const ids = [
    "refTech",
    "refJobNumber",
    "refCustomer",
    "refCity",
    "refState",
    "refEquipmentType",
    "refRefrigerantType",
    "refAddedLbs",
    "refAddedOz",
    "refRecoveredLbs",
    "refRecoveredOz",
    "refLeakSuspected",
    "refNotes",
  ];

  ids.forEach((id) => {
    const el = byId(id);
    if (!el) return;
    el.addEventListener("input", saveDraft);
    el.addEventListener("change", saveDraft);
  });
}

function bindLeakChoiceButtons() {
  const hiddenInput = byId("refLeakSuspected");
  const buttons = Array.from(document.querySelectorAll(".leakChoiceBtn"));

  if (!hiddenInput || !buttons.length) return;

  function render() {
    buttons.forEach((btn) => {
      const active = btn.dataset.value === hiddenInput.value;

      btn.className = active
        ? "leakChoiceBtn rounded-2xl border border-[#e5621c]/30 bg-[#e5621c]/15 px-4 py-4 text-base font-bold text-[#e5621c]"
        : "leakChoiceBtn rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4 text-base font-bold text-white";
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      hiddenInput.value = btn.dataset.value || "";
      saveDraft();
      render();
    });
  });

  render();
}

function showStepError(message, id) {
  showError(errorBox, message);
  byId(id)?.focus();
  return false;
}

function showTimedStatus(message, ok = true, ms = 4000) {
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }

  showStatus(statusBox, message, ok);

  statusTimer = setTimeout(() => {
    clearStatus(statusBox);
    statusTimer = null;
  }, ms);
}

function validateStep(stepIndex) {
  if (stepIndex === 0 && !getFieldValue("refTech")) {
    return showStepError("Tech Name is required.", "refTech");
  }

  if (stepIndex === 1 && !getFieldValue("refJobNumber")) {
    return showStepError("Housecall Pro Job # is required.", "refJobNumber");
  }

  if (stepIndex === 2 && !getFieldValue("refCustomer")) {
    return showStepError("Customer Name is required.", "refCustomer");
  }

  if (stepIndex === 3) {
    if (!getFieldValue("refCity")) {
      return showStepError("City is required.", "refCity");
    }
    if (!getFieldValue("refState")) {
      return showStepError("State is required.", "refState");
    }
  }

  if (stepIndex === 4 && !getFieldValue("refEquipmentType")) {
    return showStepError("Equipment Type is required.", "refEquipmentType");
  }

  if (stepIndex === 5 && !getFieldValue("refRefrigerantType")) {
    return showStepError("Refrigerant Type is required.", "refRefrigerantType");
  }

  if (stepIndex === 6) {
    const lbs = getNum("refAddedLbs");
    const oz = getNum("refAddedOz");

    if (lbs < 0) {
      return showStepError("Added pounds cannot be negative.", "refAddedLbs");
    }

    if (oz < 0 || oz >= 16) {
      return showStepError(
        "Added ounces must be between 0 and 15.9.",
        "refAddedOz",
      );
    }
  }

  if (stepIndex === 7) {
    const lbs = getNum("refRecoveredLbs");
    const oz = getNum("refRecoveredOz");

    if (lbs < 0) {
      return showStepError(
        "Recovered pounds cannot be negative.",
        "refRecoveredLbs",
      );
    }

    if (oz < 0 || oz >= 16) {
      return showStepError(
        "Recovered ounces must be between 0 and 15.9.",
        "refRecoveredOz",
      );
    }
  }

  if (stepIndex === 8 && !getFieldValue("refLeakSuspected")) {
    return showStepError("Leak Suspected is required.", "refLeakSuspected");
  }

  return true;
}

function renderReview() {
  if (!reviewList) return;

  const payload = getPayload();

  const items = [
    ["Tech", payload.techName],
    ["Job #", payload.jobNumber],
    ["Customer", payload.customerName],
    ["City / State", `${payload.city}, ${payload.state}`],
    ["Equipment", payload.equipmentType],
    ["Refrigerant", payload.refrigerantType],
    ["Added", `${payload.poundsAdded} lb`],
    ["Recovered", `${payload.poundsRecovered} lb`],
    ["Leak", payload.leakSuspected],
    ["Notes", payload.notes || "—"],
  ];

  reviewList.innerHTML = items
    .map(
      ([label, value]) => `
        <div class="rounded-xl border border-white/10 bg-neutral-900/70 px-4 py-3">
          <div class="text-xs uppercase tracking-wide text-white/45">${label}</div>
          <div class="mt-1 text-sm font-medium text-white">${value}</div>
        </div>
      `,
    )
    .join("");
}

function setQueueIndicator(count) {
  if (!queueIndicator || !queueIndicatorText) return;

  if (count > 0) {
    queueIndicator.classList.remove("hidden");
    queueIndicatorText.textContent = `${count} queued for sync`;
    return;
  }

  queueIndicator.classList.add("hidden");
  queueIndicatorText.textContent = "";
}

viewQueuedBtn?.addEventListener("click", () => {
  window.location.href = RECENT_SUBMISSIONS_URL;
});

async function updateQueueStatus() {
  const count = await getQueueCount(MODULE_KEY);
  setQueueIndicator(count);
}

async function postPayload(payload, endpoint = WEB_APP_URL) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.ok !== true) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

async function tryFlushQueue() {
  const result = await flushQueue({
    module: MODULE_KEY,
    submitFn: async (item) => {
      await postPayload(item.payload, item.endpoint);
    },
  });

  if (!result.skipped && result.sent > 0) {
    showTimedStatus(
      `${result.sent} queued submission${
        result.sent === 1 ? "" : "s"
      } synced successfully.`,
    );
  }

  await updateQueueStatus();
}

async function submitLog() {
  const payload = getPayload();
  const editingQueueId = getEditingQueueId();

  clearStatus(statusBox);
  nextBtn.disabled = true;
  nextBtn.textContent = "Submitting...";

  if (editingQueueId) {
    try {
      await updateQueuedSubmission(editingQueueId, {
        payload,
        status: "queued",
        lastError: "",
        retryCount: 0,
      });

      clearDraft();
      clearCurrentStep();
      clearEditingQueueId();
      formEl?.reset();
      populateStates();
      populateSystemTypes();
      populateRefrigerantTypes();
      wizard.setCurrentStep(0);
      await updateQueueStatus();

      window.location.href = RECENT_SUBMISSIONS_URL;
      return;
    } catch (err) {
      showStatus(
        statusBox,
        `Failed to save queued log changes. (${String(err)})`,
        false,
      );
      nextBtn.disabled = false;
      nextBtn.textContent = "Next";
      return;
    }
  }

  try {
    if (!navigator.onLine) {
      await queueSubmission({
        module: MODULE_KEY,
        endpoint: WEB_APP_URL,
        payload,
      });

      showStatus(
        statusBox,
        "No connection. Log saved locally and will sync when online.",
      );
      formEl?.reset();
      clearDraft();
      clearCurrentStep();
      populateStates();
      populateSystemTypes();
      populateRefrigerantTypes();
      wizard.setCurrentStep(0);
      await updateQueueStatus();
      return;
    }

    await postPayload(payload);

    showTimedStatus("Log submitted successfully.");
    formEl?.reset();
    clearDraft();
    clearCurrentStep();
    populateStates();
    populateSystemTypes();
    populateRefrigerantTypes();
    wizard.setCurrentStep(0);

    await tryFlushQueue();
  } catch (err) {
    await queueSubmission({
      module: MODULE_KEY,
      endpoint: WEB_APP_URL,
      payload,
    });

    showStatus(
      statusBox,
      `Submit failed live. Log saved locally and will retry when online. (${String(
        err,
      )})`,
      false,
    );

    formEl?.reset();
    clearDraft();
    clearCurrentStep();
    populateStates();
    populateSystemTypes();
    populateRefrigerantTypes();
    wizard.setCurrentStep(0);
    await updateQueueStatus();
  } finally {
    nextBtn.disabled = false;
    nextBtn.textContent = "Next";
  }
}

const wizard = createWizard({
  steps,
  progressEl,
  stepTextEl,
  nextBtn,
  backBtn,
  errorBox,
  onRenderStep: (stepIndex) => {
    saveCurrentStep(stepIndex);

    if (stepIndex === steps.length - 1) {
      renderReview();
    }

    syncEditModeUi();
  },
  onValidateStep: validateStep,
  onSubmit: submitLog,
  submitLabel: "Submit Log",
  nextLabel: "Next",
});

window.addEventListener("online", () => {
  tryFlushQueue();
});

populateStates();
populateSystemTypes();
populateRefrigerantTypes();
loadDraft();
bindDraftAutosave();
bindLeakChoiceButtons();
wizard.setCurrentStep(loadCurrentStep());
syncEditModeUi();
updateQueueStatus();
tryFlushQueue();
