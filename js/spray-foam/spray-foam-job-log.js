import {
  byId,
  clearStatus,
  createWizard,
  showError,
  showStatus,
} from "../core.js";
import {
  flushQueue,
  getQueueCount,
  queueSubmission,
  updateQueuedSubmission,
} from "../offline-queue.js";

const WEB_APP_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";

const MODULE_KEY = "spray-foam-job-log";
const DRAFT_KEY = "fieldRef.sprayFoamJobLogDraft";
const STEP_KEY = "fieldRef.sprayFoamJobLogStep";
const EDIT_QUEUE_KEY = "fieldRef.sprayFoamJobLogEditQueueId";

const steps = Array.from(document.querySelectorAll(".wizard-step"));
const progressEl = byId("wizardProgress");
const stepTextEl = byId("wizardStepText");
const nextBtn = byId("nextBtn");
const backBtn = byId("backBtn");
const errorBox = byId("wizardError");
const statusBox = byId("wizardStatus");
const formEl = byId("sprayFoamWizardForm");
const reviewList = byId("reviewList");
const queueIndicator = byId("queueIndicator");
const queueIndicatorText = byId("queueIndicatorText");
const viewQueuedBtn = byId("viewQueuedBtn");
const editQueueBanner = byId("editQueueBanner");
const addFoamEntryBtn = byId("addFoamEntryBtn");
const foamEntriesWrap = byId("sfFoamEntries");
const foamEntryTemplate = byId("foamEntryTemplate");

let wizard = null;
let statusTimer = null;
let foamEntryIdCounter = 0;

function getText(id) {
  return byId(id)?.value?.trim() || "";
}

function getNumberFromValue(value) {
  const n = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

function getNum(id) {
  return getNumberFromValue(byId(id)?.value ?? "");
}

function generateSubmissionId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `sf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateFoamEntryId() {
  foamEntryIdCounter += 1;
  return `foam_${Date.now()}_${foamEntryIdCounter}`;
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

function showStepError(message, id) {
  showError(errorBox, message);
  byId(id)?.focus();
  return false;
}

function setQueueIndicator(count) {
  if (!queueIndicator || !queueIndicatorText) return;

  if (count > 0) {
    queueIndicator.classList.remove("hidden");
    queueIndicatorText.textContent = `${count} queued for sync`;
  } else {
    queueIndicator.classList.add("hidden");
    queueIndicatorText.textContent = "";
  }
}

function getEditingQueueId() {
  const raw = localStorage.getItem(EDIT_QUEUE_KEY);
  const id = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function clearEditingQueueId() {
  localStorage.removeItem(EDIT_QUEUE_KEY);
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

function syncEditModeUi() {
  const editingId = getEditingQueueId();

  if (editQueueBanner) {
    editQueueBanner.classList.toggle("hidden", !editingId);
  }

  if (!nextBtn || !wizard) return;

  if (wizard.getCurrentStep() === steps.length - 1) {
    nextBtn.textContent = editingId ? "Save Changes" : "Submit Log";
  }
}

function setYesNoButtonState(groupTarget) {
  const buttons = Array.from(
    document.querySelectorAll(`.yesNoBtn[data-target="${groupTarget}"]`),
  );
  const hiddenInput = byId(groupTarget);
  const selectedValue = hiddenInput?.value || "";

  buttons.forEach((btn) => {
    const active = btn.dataset.value === selectedValue;
    btn.className = active
      ? "yesNoBtn rounded-2xl border border-amber-400/30 bg-amber-500/15 px-4 py-4 text-base font-bold text-amber-200 transition active:scale-[0.98]"
      : "yesNoBtn rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4 text-base font-bold text-white transition active:scale-[0.98]";
  });
}

function bindYesNoButtons() {
  const buttons = Array.from(document.querySelectorAll(".yesNoBtn"));

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const value = btn.dataset.value || "";
      const hiddenInput = byId(targetId);

      if (!hiddenInput) return;

      hiddenInput.value = value;
      setYesNoButtonState(targetId);
      saveDraft();
    });
  });

  const targets = new Set(
    buttons.map((btn) => btn.dataset.target).filter(Boolean),
  );

  targets.forEach((targetId) => setYesNoButtonState(targetId));
}

function createFoamEntryElement(entry = {}) {
  if (!foamEntryTemplate || !foamEntriesWrap) return null;

  const fragment = foamEntryTemplate.content.cloneNode(true);
  const root = fragment.querySelector(".foam-entry");
  if (!root) return null;

  root.dataset.entryId = entry.entryId || generateFoamEntryId();

  const categoryEl = root.querySelector(".foam-category");
  const otherWrap = root.querySelector(".foam-other-wrap");
  const otherTypeEl = root.querySelector(".foam-other-type");
  const brandEl = root.querySelector(".foam-brand");
  const lotEl = root.querySelector(".foam-lot");
  const setsUsedEl = root.querySelector(".foam-sets-used");
  const thicknessEl = root.querySelector(".foam-thickness");
  const areaEl = root.querySelector(".foam-area");
  const removeBtn = root.querySelector(".removeFoamEntryBtn");

  categoryEl.value = entry.category || "";
  otherTypeEl.value = entry.otherType || "";
  brandEl.value = entry.brandName || "";
  lotEl.value = entry.lotNumber || "";
  setsUsedEl.value =
    entry.setsUsed !== undefined && entry.setsUsed !== null
      ? String(entry.setsUsed)
      : "";
  thicknessEl.value =
    entry.avgThickness !== undefined && entry.avgThickness !== null
      ? String(entry.avgThickness)
      : "";
  areaEl.value =
    entry.installedAreaSqFt !== undefined && entry.installedAreaSqFt !== null
      ? String(entry.installedAreaSqFt)
      : "";

  function syncOtherVisibility() {
    const isOther = categoryEl.value === "Other";
    otherWrap.classList.toggle("hidden", !isOther);
    if (!isOther) {
      otherTypeEl.value = "";
    }
  }

  categoryEl.addEventListener("change", () => {
    syncOtherVisibility();
    saveDraft();
  });
  [otherTypeEl, brandEl, lotEl, setsUsedEl, thicknessEl, areaEl].forEach(
    (el) => {
      el.addEventListener("input", saveDraft);
      el.addEventListener("change", saveDraft);
    },
  );

  removeBtn?.addEventListener("click", () => {
    root.remove();
    saveDraft();
    renderReview();
  });

  syncOtherVisibility();
  return root;
}

function addFoamEntry(entry = {}) {
  const el = createFoamEntryElement(entry);
  if (!el || !foamEntriesWrap) return;
  foamEntriesWrap.appendChild(el);
  renderReview();
}

function getFoamEntries() {
  return Array.from(document.querySelectorAll(".foam-entry")).map((entryEl) => {
    const category =
      entryEl.querySelector(".foam-category")?.value?.trim() || "";
    const otherType =
      entryEl.querySelector(".foam-other-type")?.value?.trim() || "";
    const brandName = entryEl.querySelector(".foam-brand")?.value?.trim() || "";
    const lotNumber = entryEl.querySelector(".foam-lot")?.value?.trim() || "";
    const setsUsed = getNumberFromValue(
      entryEl.querySelector(".foam-sets-used")?.value ?? "",
    );
    const avgThickness = getNumberFromValue(
      entryEl.querySelector(".foam-thickness")?.value ?? "",
    );
    const installedAreaSqFt = getNumberFromValue(
      entryEl.querySelector(".foam-area")?.value ?? "",
    );

    return {
      entryId: entryEl.dataset.entryId || generateFoamEntryId(),
      category,
      otherType,
      brandName,
      lotNumber,
      setsUsed,
      avgThickness,
      installedAreaSqFt,
    };
  });
}

function getDraftData() {
  return {
    submissionId:
      JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}")?.submissionId || "",
    sfDate: byId("sfDate")?.value ?? "",
    sfJobNumber: byId("sfJobNumber")?.value ?? "",
    sfCustomerName: byId("sfCustomerName")?.value ?? "",
    sfCity: byId("sfCity")?.value ?? "",
    sfTech: byId("sfTech")?.value ?? "",
    sfHelperCrew: byId("sfHelperCrew")?.value ?? "",
    sfPhotosUploaded: byId("sfPhotosUploaded")?.value ?? "",
    sfJobNotes: byId("sfJobNotes")?.value ?? "",
    sfAmbientTemp: byId("sfAmbientTemp")?.value ?? "",
    sfSubstrateTemp: byId("sfSubstrateTemp")?.value ?? "",
    sfHumidity: byId("sfHumidity")?.value ?? "",
    sfHoseTemp: byId("sfHoseTemp")?.value ?? "",
    sfPressure: byId("sfPressure")?.value ?? "",
    sfDowntime: byId("sfDowntime")?.value ?? "",
    sfWasteGallons: byId("sfWasteGallons")?.value ?? "",
    sfWasteNotes: byId("sfWasteNotes")?.value ?? "",
    foamEntries: getFoamEntries(),
  };
}

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(getDraftData()));
}

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) {
    if (!foamEntriesWrap?.children.length) addFoamEntry();
    return;
  }

  try {
    const draft = JSON.parse(raw);

    const simpleFieldIds = [
      "sfDate",
      "sfJobNumber",
      "sfCustomerName",
      "sfCity",
      "sfTech",
      "sfHelperCrew",
      "sfPhotosUploaded",
      "sfJobNotes",
      "sfAmbientTemp",
      "sfSubstrateTemp",
      "sfHumidity",
      "sfHoseTemp",
      "sfPressure",
      "sfDowntime",
      "sfWasteGallons",
      "sfWasteNotes",
    ];

    simpleFieldIds.forEach((id) => {
      const el = byId(id);
      if (!el) return;
      el.value = draft[id] ?? "";
    });

    if (foamEntriesWrap) {
      foamEntriesWrap.innerHTML = "";

      if (Array.isArray(draft.foamEntries) && draft.foamEntries.length) {
        draft.foamEntries.forEach((entry) => addFoamEntry(entry));
      } else {
        addFoamEntry();
      }
    }
  } catch (err) {
    console.error("Failed to load spray foam draft:", err);
    if (!foamEntriesWrap?.children.length) addFoamEntry();
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function formatProductLabel(entry) {
  if (entry.category === "Other" && entry.otherType) {
    return `Other - ${entry.otherType}`;
  }
  return entry.category || "—";
}

function getPayload() {
  const existingDraft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
  const submissionId = existingDraft.submissionId || generateSubmissionId();

  return {
    submissionId,
    date: getText("sfDate"),
    jobNumber: getText("sfJobNumber"),
    customerName: getText("sfCustomerName"),
    city: getText("sfCity"),
    sprayer: getText("sfTech"),
    helperCrew: getText("sfHelperCrew"),
    photosUploadedToHcp: getText("sfPhotosUploaded"),
    otherNotes: getText("sfJobNotes"),

    ambientTempF: getNum("sfAmbientTemp"),
    substrateTempF: getNum("sfSubstrateTemp"),
    humidityPercent: getNum("sfHumidity"),
    hoseTempF: getNum("sfHoseTemp"),
    pressurePsi: getNum("sfPressure"),
    downtime: getText("sfDowntime"),

    wasteGallons: getNum("sfWasteGallons"),
    wasteReturnNotes: getText("sfWasteNotes"),

    productEntries: getFoamEntries().map((entry) => ({
      productCategory: entry.category,
      otherProductType: entry.category === "Other" ? entry.otherType : "",
      productBrandName: entry.brandName,
      setLotNumber: entry.lotNumber,
      setsUsed: entry.setsUsed,
      installedAreaSqFt: entry.installedAreaSqFt,
      averageThicknessIn: entry.avgThickness,
    })),
  };
}

function renderReview() {
  if (!reviewList) return;

  const payload = getPayload();

  const productHtml = payload.productEntries.length
    ? payload.productEntries
        .map(
          (entry, idx) => `
            <div class="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3">
              <div class="text-xs uppercase tracking-wide text-white/45">Product ${idx + 1}</div>
              <div class="mt-1 text-sm font-medium text-white">
                ${
                  entry.productCategory === "Other" && entry.otherProductType
                    ? `Other - ${entry.otherProductType}`
                    : entry.productCategory || "—"
                }
              </div>
              <div class="mt-2 text-xs text-white/60">
                Brand: ${entry.productBrandName || "—"}<br />
                Lot: ${entry.setLotNumber || "—"}<br />
                Sets: ${entry.setsUsed || 0}<br />
                Area: ${entry.installedAreaSqFt || 0} sq ft<br />
                Thickness: ${entry.averageThicknessIn || 0} in
              </div>
            </div>
          `,
        )
        .join("")
    : `
      <div class="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white/60">
        No products added yet.
      </div>
    `;

  const items = [
    ["Date", payload.date || "—"],
    ["Job #", payload.jobNumber || "—"],
    ["Customer / Site", payload.customerName || "—"],
    ["City", payload.city || "—"],
    ["Sprayer", payload.sprayer || "—"],
    ["Helper / Crew", payload.helperCrew || "—"],
    ["Photos uploaded to HCP?", payload.photosUploadedToHcp || "—"],
    ["Ambient Temp", payload.ambientTempF ? `${payload.ambientTempF} °F` : "—"],
    [
      "Substrate Temp",
      payload.substrateTempF ? `${payload.substrateTempF} °F` : "—",
    ],
    ["Humidity", payload.humidityPercent ? `${payload.humidityPercent}%` : "—"],
    ["Hose Temp", payload.hoseTempF ? `${payload.hoseTempF} °F` : "—"],
    ["Pressure", payload.pressurePsi ? `${payload.pressurePsi} psi` : "—"],
    ["Downtime", payload.downtime || "—"],
    ["Waste", payload.wasteGallons ? `${payload.wasteGallons} gal` : "—"],
    ["Waste / Return Notes", payload.wasteReturnNotes || "—"],
    ["Other Notes", payload.otherNotes || "—"],
  ];

  reviewList.innerHTML = `
    ${items
      .map(
        ([label, value]) => `
          <div class="rounded-xl border border-white/10 bg-neutral-900/70 px-4 py-3">
            <div class="text-xs uppercase tracking-wide text-white/45">${label}</div>
            <div class="mt-1 text-sm font-medium text-white">${value}</div>
          </div>
        `,
      )
      .join("")}
    <div class="rounded-xl border border-white/10 bg-neutral-900/70 px-4 py-3">
      <div class="text-xs uppercase tracking-wide text-white/45">Products Used</div>
      <div class="mt-3 space-y-3">${productHtml}</div>
    </div>
  `;
}

function validateProductEntries() {
  const entries = getFoamEntries();

  if (!entries.length) {
    showError(errorBox, "Add at least one product entry.");
    return false;
  }

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const label = `Product ${i + 1}`;

    if (!entry.category) {
      showError(errorBox, `${label}: Product Category is required.`);
      return false;
    }

    if (entry.category === "Other" && !entry.otherType) {
      showError(errorBox, `${label}: Other Product Type is required.`);
      return false;
    }

    if (!entry.brandName) {
      showError(errorBox, `${label}: Product Brand / Name is required.`);
      return false;
    }

    if (!entry.lotNumber) {
      showError(errorBox, `${label}: Set / Lot # is required.`);
      return false;
    }

    if (entry.setsUsed <= 0) {
      showError(errorBox, `${label}: Sets Used must be greater than 0.`);
      return false;
    }

    if (entry.installedAreaSqFt <= 0) {
      showError(errorBox, `${label}: Installed Area must be greater than 0.`);
      return false;
    }

    if (entry.avgThickness <= 0) {
      showError(
        errorBox,
        `${label}: Average Thickness must be greater than 0.`,
      );
      return false;
    }
  }

  return true;
}

function validateStep(stepIndex) {
  if (stepIndex === 0) {
    if (!getText("sfDate")) return showStepError("Date is required.", "sfDate");
    if (!getText("sfJobNumber"))
      return showStepError("Job # is required.", "sfJobNumber");
    if (!getText("sfCustomerName")) {
      return showStepError(
        "Customer / Site Name is required.",
        "sfCustomerName",
      );
    }
    if (!getText("sfCity")) return showStepError("City is required.", "sfCity");
    if (!getText("sfTech"))
      return showStepError("Sprayer is required.", "sfTech");
    return true;
  }

  if (stepIndex === 1) {
    if (!byId("sfAmbientTemp")?.value) {
      return showStepError("Ambient Temp is required.", "sfAmbientTemp");
    }
    if (!byId("sfSubstrateTemp")?.value) {
      return showStepError("Substrate Temp is required.", "sfSubstrateTemp");
    }
    if (!byId("sfHumidity")?.value) {
      return showStepError("Humidity is required.", "sfHumidity");
    }
    if (!byId("sfHoseTemp")?.value) {
      return showStepError("Hose Temp is required.", "sfHoseTemp");
    }
    if (!byId("sfPressure")?.value) {
      return showStepError("Pressure is required.", "sfPressure");
    }
    return true;
  }

  if (stepIndex === 2) {
    return validateProductEntries();
  }

  return true;
}

function resetFormUi() {
  formEl?.reset();
  if (foamEntriesWrap) {
    foamEntriesWrap.innerHTML = "";
    addFoamEntry();
  }
  clearDraft();
  clearCurrentStep();
  clearEditingQueueId();
  bindYesNoButtons();
  wizard.setCurrentStep(0);
  renderReview();
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

async function updateQueueStatus() {
  const count = await getQueueCount(MODULE_KEY);
  setQueueIndicator(count);
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
      `${result.sent} queued submission${result.sent === 1 ? "" : "s"} synced successfully.`,
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

      resetFormUi();
      await updateQueueStatus();
      showTimedStatus("Queued spray foam log updated.");
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

      resetFormUi();
      await updateQueueStatus();
      return;
    }

    await postPayload(payload);

    showTimedStatus("Log submitted successfully.");
    resetFormUi();
    await tryFlushQueue();
  } catch (err) {
    await queueSubmission({
      module: MODULE_KEY,
      endpoint: WEB_APP_URL,
      payload,
    });

    showStatus(
      statusBox,
      `Submit failed live. Log saved locally and will retry when online. (${String(err)})`,
      false,
    );

    resetFormUi();
    await updateQueueStatus();
  } finally {
    nextBtn.disabled = false;
    nextBtn.textContent = "Next";
  }
}

function bindSimpleFieldAutosave() {
  const ids = [
    "sfDate",
    "sfJobNumber",
    "sfCustomerName",
    "sfCity",
    "sfTech",
    "sfHelperCrew",
    "sfPhotosUploaded",
    "sfJobNotes",
    "sfAmbientTemp",
    "sfSubstrateTemp",
    "sfHumidity",
    "sfHoseTemp",
    "sfPressure",
    "sfDowntime",
    "sfWasteGallons",
    "sfWasteNotes",
  ];

  ids.forEach((id) => {
    const el = byId(id);
    if (!el) return;
    el.addEventListener("input", saveDraft);
    el.addEventListener("change", saveDraft);
  });
}

viewQueuedBtn?.addEventListener("click", () => {
  showTimedStatus("Queued spray foam log view is not wired yet.", false);
});

addFoamEntryBtn?.addEventListener("click", () => {
  addFoamEntry();
  saveDraft();
});

window.addEventListener("online", () => {
  tryFlushQueue();
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

loadDraft();
bindSimpleFieldAutosave();
bindYesNoButtons();
wizard.setCurrentStep(loadCurrentStep());
syncEditModeUi();
renderReview();
updateQueueStatus();
tryFlushQueue();
