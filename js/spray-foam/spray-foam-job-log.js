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

const addProductBtn = byId("addProductBtn");
const savedProductsWrap = byId("sfSavedProducts");
const savedProductCardTemplate = byId("savedProductCardTemplate");

let wizard = null;
let statusTimer = null;
let savedProducts = [];

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

function generateProductId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
  if (id) byId(id)?.focus();
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

function syncEditModeUi() {
  const editingId = getEditingQueueId();

  if (editQueueBanner) {
    editQueueBanner.classList.toggle("hidden", !editingId);
  }

  if (!nextBtn || !wizard) return;

  if (wizard.getCurrentStep() === steps.length - 1) {
    nextBtn.textContent = editingId ? "Save Changes" : "Submit Log";
  } else {
    nextBtn.textContent = "Next";
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
      renderReview();
    });
  });

  const targets = new Set(
    buttons.map((btn) => btn.dataset.target).filter(Boolean),
  );
  targets.forEach((targetId) => setYesNoButtonState(targetId));
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
    "sfProductCategory",
    "sfOtherProductType",
    "sfProductBrandName",
    "sfSetLotNumber",
    "sfSetsUsed",
    "sfAvgThickness",
    "sfInstalledArea",
  ];

  ids.forEach((id) => {
    const el = byId(id);
    if (!el) return;
    el.addEventListener("input", () => {
      saveDraft();
      renderReview();
    });
    el.addEventListener("change", () => {
      saveDraft();
      renderReview();
    });
  });
}

function bindProductCategoryToggle() {
  const categoryEl = byId("sfProductCategory");
  const otherWrap = byId("sfOtherProductWrap");
  const otherInput = byId("sfOtherProductType");

  if (!categoryEl || !otherWrap) return;

  const sync = () => {
    const isOther = categoryEl.value === "Other";
    otherWrap.classList.toggle("hidden", !isOther);
    if (!isOther && otherInput) otherInput.value = "";
    saveDraft();
    renderReview();
  };

  categoryEl.addEventListener("change", sync);
  sync();
}

function getCurrentProductDraft() {
  return {
    id: null,
    productCategory: getText("sfProductCategory"),
    otherProductType: getText("sfOtherProductType"),
    productBrandName: getText("sfProductBrandName"),
    setLotNumber: getText("sfSetLotNumber"),
    setsUsed: getNum("sfSetsUsed"),
    installedAreaSqFt: getNum("sfInstalledArea"),
    averageThicknessIn: getNum("sfAvgThickness"),
  };
}

function currentProductHasAnyData() {
  const p = getCurrentProductDraft();
  return Boolean(
    p.productCategory ||
    p.otherProductType ||
    p.productBrandName ||
    p.setLotNumber ||
    p.setsUsed > 0 ||
    p.installedAreaSqFt > 0 ||
    p.averageThicknessIn > 0,
  );
}

function validateProduct(product, prefix = "Current Product") {
  if (!product.productCategory) {
    showError(errorBox, `${prefix}: Product Category is required.`);
    byId("sfProductCategory")?.focus();
    return false;
  }

  if (product.productCategory === "Other" && !product.otherProductType) {
    showError(errorBox, `${prefix}: Other Product Type is required.`);
    byId("sfOtherProductType")?.focus();
    return false;
  }

  if (!product.productBrandName) {
    showError(errorBox, `${prefix}: Product Brand / Name is required.`);
    byId("sfProductBrandName")?.focus();
    return false;
  }

  if (!product.setLotNumber) {
    showError(errorBox, `${prefix}: Set / Lot # is required.`);
    byId("sfSetLotNumber")?.focus();
    return false;
  }

  if (product.setsUsed <= 0) {
    showError(errorBox, `${prefix}: Sets Used must be greater than 0.`);
    byId("sfSetsUsed")?.focus();
    return false;
  }

  if (product.installedAreaSqFt <= 0) {
    showError(errorBox, `${prefix}: Installed Area must be greater than 0.`);
    byId("sfInstalledArea")?.focus();
    return false;
  }

  if (product.averageThicknessIn <= 0) {
    showError(errorBox, `${prefix}: Avg Thickness must be greater than 0.`);
    byId("sfAvgThickness")?.focus();
    return false;
  }

  return true;
}

function clearCurrentProductFields() {
  const ids = [
    "sfProductCategory",
    "sfOtherProductType",
    "sfProductBrandName",
    "sfSetLotNumber",
    "sfSetsUsed",
    "sfAvgThickness",
    "sfInstalledArea",
  ];

  ids.forEach((id) => {
    const el = byId(id);
    if (el) el.value = "";
  });

  byId("sfOtherProductWrap")?.classList.add("hidden");
}

function formatProductTitle(product) {
  if (product.productCategory === "Other" && product.otherProductType) {
    return `Other - ${product.otherProductType}`;
  }
  return product.productCategory || "Product";
}

function renderSavedProducts() {
  if (!savedProductsWrap) return;
  savedProductsWrap.innerHTML = "";

  if (!savedProducts.length) {
    savedProductsWrap.innerHTML = `
      <div class="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white/55">
        No saved products yet.
      </div>
    `;
    return;
  }

  savedProducts.forEach((product) => {
    const fragment = savedProductCardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".saved-product-card");
    const title = fragment.querySelector(".saved-product-title");
    const meta = fragment.querySelector(".saved-product-meta");
    const removeBtn = fragment.querySelector(".removeSavedProductBtn");

    card.dataset.productId = product.id;
    title.textContent = formatProductTitle(product);
    meta.innerHTML = `
      Brand: ${product.productBrandName || "—"}<br />
      Lot: ${product.setLotNumber || "—"}<br />
      Sets: ${product.setsUsed || 0} · Area: ${product.installedAreaSqFt || 0} sq ft · Thickness: ${product.averageThicknessIn || 0} in
    `;

    removeBtn?.addEventListener("click", () => {
      savedProducts = savedProducts.filter((p) => p.id !== product.id);
      renderSavedProducts();
      saveDraft();
      renderReview();
    });

    savedProductsWrap.appendChild(fragment);
  });
}

function getAllProductsForSubmission({ includeCurrentDraft = true } = {}) {
  const products = [...savedProducts];

  if (includeCurrentDraft && currentProductHasAnyData()) {
    const current = getCurrentProductDraft();
    products.push({
      id: generateProductId(),
      ...current,
    });
  }

  return products;
}

function addCurrentProductToSaved() {
  const current = getCurrentProductDraft();

  if (!validateProduct(current)) return false;

  savedProducts.push({
    id: generateProductId(),
    ...current,
  });

  clearCurrentProductFields();
  renderSavedProducts();
  saveDraft();
  renderReview();
  showTimedStatus("Product added.");
  byId("sfProductCategory")?.focus();
  return true;
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
    sfProductCategory: byId("sfProductCategory")?.value ?? "",
    sfOtherProductType: byId("sfOtherProductType")?.value ?? "",
    sfProductBrandName: byId("sfProductBrandName")?.value ?? "",
    sfSetLotNumber: byId("sfSetLotNumber")?.value ?? "",
    sfSetsUsed: byId("sfSetsUsed")?.value ?? "",
    sfAvgThickness: byId("sfAvgThickness")?.value ?? "",
    sfInstalledArea: byId("sfInstalledArea")?.value ?? "",
    savedProducts,
  };
}

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(getDraftData()));
}

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) {
    renderSavedProducts();
    return;
  }

  try {
    const draft = JSON.parse(raw);

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
      "sfProductCategory",
      "sfOtherProductType",
      "sfProductBrandName",
      "sfSetLotNumber",
      "sfSetsUsed",
      "sfAvgThickness",
      "sfInstalledArea",
    ];

    ids.forEach((id) => {
      const el = byId(id);
      if (!el) return;
      el.value = draft[id] ?? "";
    });

    savedProducts = Array.isArray(draft.savedProducts)
      ? draft.savedProducts
      : [];
    renderSavedProducts();
    bindProductCategoryToggle();
  } catch (err) {
    console.error("Failed to load spray foam draft:", err);
    savedProducts = [];
    renderSavedProducts();
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function getPayload() {
  const existingDraft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
  const submissionId = existingDraft.submissionId || generateSubmissionId();
  const productEntries = getAllProductsForSubmission({
    includeCurrentDraft: true,
  });

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

    productEntries: productEntries.map((product) => ({
      productCategory: product.productCategory,
      otherProductType:
        product.productCategory === "Other" ? product.otherProductType : "",
      productBrandName: product.productBrandName,
      setLotNumber: product.setLotNumber,
      setsUsed: product.setsUsed,
      installedAreaSqFt: product.installedAreaSqFt,
      averageThicknessIn: product.averageThicknessIn,
    })),
  };
}

function renderReview() {
  if (!reviewList) return;

  const payload = getPayload();

  const infoItems = [
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
    [
      "Waste",
      byId("sfWasteGallons")?.value ? `${payload.wasteGallons} gal` : "—",
    ],
    ["Waste / Return Notes", payload.wasteReturnNotes || "—"],
    ["Other Notes", payload.otherNotes || "—"],
  ];

  const productsHtml = payload.productEntries.length
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
      <div class="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white/55">
        No products entered yet.
      </div>
    `;

  reviewList.innerHTML = `
    ${infoItems
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
      <div class="mt-3 space-y-3">${productsHtml}</div>
    </div>
  `;
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
    const allProducts = getAllProductsForSubmission({
      includeCurrentDraft: true,
    });

    if (!allProducts.length) {
      showError(errorBox, "Enter at least one product before continuing.");
      byId("sfProductCategory")?.focus();
      return false;
    }

    if (currentProductHasAnyData()) {
      return validateProduct(getCurrentProductDraft(), "Current Product");
    }

    return true;
  }

  return true;
}

function resetFormUi() {
  formEl?.reset();
  savedProducts = [];
  renderSavedProducts();
  clearCurrentProductFields();
  clearDraft();
  clearCurrentStep();
  clearEditingQueueId();
  bindYesNoButtons();
  bindProductCategoryToggle();
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

viewQueuedBtn?.addEventListener("click", () => {
  showTimedStatus("Queued spray foam log view is not wired yet.", false);
});

addProductBtn?.addEventListener("click", () => {
  addCurrentProductToSaved();
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
bindProductCategoryToggle();
wizard.setCurrentStep(loadCurrentStep());
renderSavedProducts();
syncEditModeUi();
renderReview();
updateQueueStatus();
tryFlushQueue();
