import { $, toNum } from "../core.js";

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxXQMKS7z9XqZNUGBCAMiE12YgNnq0w-ZjjZ_vcv-X0q5URtFgc3JvRWKJeVAificqx/exec";

export async function submitRefrigerantLog() {
  const out = $("refLogResult");
  if (!out) return;

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

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      out.textContent = `Submit failed: ${data.error || `HTTP ${res.status}`}`;
      return;
    }

    out.textContent = "Log submitted successfully ✅";

    ["refTech","refJobNumber","refCustomer","refCity","refNotes"].forEach((id) => {
      const el = $(id); if (el) el.value = "";
    });

    ["refEquipmentType","refRefrigerantType","refLeakSuspected"].forEach((id) => {
      const el = $(id); if (el) el.selectedIndex = 0;
    });

    ["refPoundsAdded","refPoundsRecovered"].forEach((id) => {
      const el = $(id); if (el) el.value = "";
    });

  } catch (err) {
    out.textContent = `Network/error: ${String(err)}`;
  }
}
