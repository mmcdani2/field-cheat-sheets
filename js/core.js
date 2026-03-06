export const $ = (id) => document.getElementById(id);

export function byId(id) {
  return document.getElementById(id);
}

export function toNum(id) {
  const el = byId(id);
  if (!el) return 0;
  const v = Number.parseFloat(el.value);
  return Number.isFinite(v) ? v : 0;
}

export function fmt(n, d = 2) {
  return Number(n).toFixed(d);
}

export function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

export function setText(id, text) {
  const el = byId(id);
  if (el) el.textContent = text;
}

export async function loadPartial(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

export function initAccordion(root = document) {
  const groups = root.querySelectorAll("[data-accordion]");

  groups.forEach((group) => {
    if (group.dataset.bound === "1") return;
    group.dataset.bound = "1";

    group.addEventListener("click", (e) => {
      const btn = e.target.closest(".acc-trigger");
      if (!btn || !group.contains(btn)) return;

      const ownerGroup = btn.closest("[data-accordion]");
      if (ownerGroup !== group) return;

      e.stopPropagation();

      const item = btn.closest(".acc-item");
      if (!item) return;

      const isOpen = item.classList.contains("open");
      const allowMultiple = group.dataset.allowMultiple === "true";

      if (!allowMultiple) {
        Array.from(group.children).forEach((child) => {
          if (child !== item) child.classList.remove("open");
        });
      }

      item.classList.toggle("open", !isOpen);
    });
  });
}

export function showError(errorBox, message) {
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

export function clearError(errorBox) {
  if (!errorBox) return;
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

export function showStatus(statusBox, message, ok = true) {
  if (!statusBox) return;

  statusBox.textContent = message;
  statusBox.className = ok
    ? "mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
    : "mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200";

  statusBox.classList.remove("hidden");
}

export function clearStatus(statusBox) {
  if (!statusBox) return;
  statusBox.textContent = "";
  statusBox.classList.add("hidden");
}

export function populateSelect(selectEl, items, placeholder = "Select option") {
  if (!selectEl) return;

  selectEl.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder;
  selectEl.appendChild(first);

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    selectEl.appendChild(option);
  });
}

export function createWizard(config) {
  const {
    steps,
    progressEl,
    stepTextEl,
    nextBtn,
    backBtn,
    errorBox,
    onRenderStep,
    onValidateStep,
    onSubmit,
    submitLabel = "Submit",
    nextLabel = "Next",
  } = config;

  let currentStep = 0;

  function renderStep() {
    steps.forEach((step, index) => {
      step.classList.toggle("hidden", index !== currentStep);
    });

    const pct = ((currentStep + 1) / steps.length) * 100;
    if (progressEl) progressEl.style.width = `${pct}%`;
    if (stepTextEl) stepTextEl.textContent = `Step ${currentStep + 1} of ${steps.length}`;
    if (backBtn) backBtn.classList.toggle("hidden", currentStep === 0);
    if (nextBtn) nextBtn.textContent = currentStep === steps.length - 1 ? submitLabel : nextLabel;

    clearError(errorBox);

    if (typeof onRenderStep === "function") {
      onRenderStep(currentStep);
    }
  }

  async function handleNext() {
    if (typeof onValidateStep === "function") {
      const valid = onValidateStep(currentStep);
      if (!valid) return;
    }

    if (currentStep < steps.length - 1) {
      currentStep += 1;
      renderStep();
      steps[currentStep].querySelector("input, select, textarea")?.focus();
      return;
    }

    if (typeof onSubmit === "function") {
      await onSubmit();
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      currentStep -= 1;
      renderStep();
      steps[currentStep].querySelector("input, select, textarea")?.focus();
    }
  }

  nextBtn?.addEventListener("click", handleNext);
  backBtn?.addEventListener("click", handleBack);

  return {
    renderStep,
    getCurrentStep: () => currentStep,
    setCurrentStep: (value) => {
      currentStep = value;
      renderStep();
    },
  };
}