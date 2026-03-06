import { LABOR_RATES, PRICING_DEFAULTS } from '../../data/labor-rates.js'

const materialCostEl = document.getElementById('materialCost')
const laborHoursEl = document.getElementById('laborHours')
const laborRateEl = document.getElementById('laborRate')
const targetMarginEl = document.getElementById('targetMargin')

const laborCostEl = document.getElementById('laborCost')
const totalCostEl = document.getElementById('totalCost')
const quotePriceEl = document.getElementById('quotePrice')
const marginLabelEl = document.getElementById('marginLabel')

const resetBtn = document.getElementById('resetBtn')

function currency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(value) || 0)
}

function num(value) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function calculate() {
  const materialCost = num(materialCostEl?.value)
  const laborHours = num(laborHoursEl?.value)
  const laborRate = num(laborRateEl?.value)
  const targetMarginPercent = num(targetMarginEl?.value)

  const targetMargin = targetMarginPercent / 100

  const laborCost = laborHours * laborRate
  const totalCost = materialCost + laborCost

  let quote = 0

  if (targetMargin >= 0 && targetMargin < 1) {
    quote = totalCost / (1 - targetMargin)
  }

  if (laborCostEl) laborCostEl.textContent = currency(laborCost)
  if (totalCostEl) totalCostEl.textContent = currency(totalCost)
  if (quotePriceEl) quotePriceEl.textContent = currency(quote)
  if (marginLabelEl) marginLabelEl.textContent = `${targetMarginPercent.toFixed(0)}% target margin`
}

function resetForm() {
  if (materialCostEl) materialCostEl.value = ''
  if (laborHoursEl) laborHoursEl.value = ''
  if (laborRateEl) laborRateEl.value = String(LABOR_RATES.hvacService)
  if (targetMarginEl) targetMarginEl.value = String(PRICING_DEFAULTS.targetMargin * 100)
  calculate()
}

if (laborRateEl) laborRateEl.value = String(LABOR_RATES.hvacService)
if (targetMarginEl) targetMarginEl.value = String(PRICING_DEFAULTS.targetMargin * 100)

;[materialCostEl, laborHoursEl, laborRateEl, targetMarginEl].forEach((el) => {
  el?.addEventListener('input', calculate)
  el?.addEventListener('change', calculate)
})

resetBtn?.addEventListener('click', resetForm)

calculate()