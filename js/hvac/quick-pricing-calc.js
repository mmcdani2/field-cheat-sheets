import { LABOR_RATES, PRICING_TIERS } from '../data/labor-rates.js'

const materialCostEl = document.getElementById('materialCost')
const laborHoursEl = document.getElementById('laborHours')
const tierButtons = Array.from(document.querySelectorAll('.tierBtn'))

const laborCostEl = document.getElementById('laborCost')
const totalCostEl = document.getElementById('totalCost')
const quotePriceEl = document.getElementById('quotePrice')
const marginLabelEl = document.getElementById('marginLabel')

const resetBtn = document.getElementById('resetBtn')

let selectedTier = 'med'

function currency (value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(value) || 0)
}

function num (value) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getLaborRate () {
  return Number(LABOR_RATES.hvacService || 0)
}

function getTargetMargin () {
  return Number(PRICING_TIERS[selectedTier] || 0)
}

function getTargetMarginPercent () {
  return getTargetMargin() * 100
}

function renderTierButtons () {
  tierButtons.forEach(btn => {
    const isActive = btn.dataset.tier === selectedTier

    btn.className = isActive
      ? 'tierBtn rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-cyan-200'
      : 'tierBtn rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/85'
  })
}

function calculate () {
  const materialCost = num(materialCostEl?.value)
  const laborHours = num(laborHoursEl?.value)
  const laborRate = getLaborRate()
  const targetMargin = getTargetMargin()
  const targetMarginPercent = getTargetMarginPercent()

  const laborCost = laborHours * laborRate
  const totalCost = materialCost + laborCost

  let quote = 0

  if (targetMargin >= 0 && targetMargin < 1) {
    quote = totalCost / (1 - targetMargin)
  }

  if (laborCostEl) laborCostEl.textContent = currency(laborCost)
  if (totalCostEl) totalCostEl.textContent = currency(totalCost)
  if (quotePriceEl) quotePriceEl.textContent = currency(quote)
  if (marginLabelEl) {
    marginLabelEl.textContent = `${targetMarginPercent.toFixed(
      0
    )}% target margin`
  }

  renderTierButtons()
}

function resetForm() {
  if (materialCostEl) materialCostEl.value = ''
  if (laborHoursEl) laborHoursEl.value = ''
  selectedTier = 'med'
  calculate()
}

;[materialCostEl, laborHoursEl].forEach((el) => {
  el?.addEventListener('input', calculate)
  el?.addEventListener('change', calculate)
})

tierButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedTier = btn.dataset.tier || 'med'
    calculate()
  })
})

resetBtn?.addEventListener('click', resetForm)

calculate()
