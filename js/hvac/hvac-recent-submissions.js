import { byId, clearStatus, showStatus } from '../core.js'
import {
  flushQueue,
  getQueuedSubmissions,
  removeQueuedSubmission
} from '../offline-queue.js'

const MODULE_KEY = 'refrigerant-log'
const DRAFT_KEY = 'fieldRef.refrigerantLogDraft'
const STEP_KEY = 'fieldRef.refrigerantLogStep'
const EDIT_QUEUE_KEY = 'fieldRef.refrigerantLogEditQueueId'
const REFRIGERANT_FORM_URL = '../../partials/hvac/refrigerant-log.html'
const WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycby-mLUIwoSTYPerbvQTmA578AQYiaj0lrG--dxQMytHn3H0a90OnltOY1DWETDjYeTi/exec'

const queuedCountEl = byId('queuedCount')
const failedCountEl = byId('failedCount')
const retryAllBtn = byId('retryAllBtn')
const refreshBtn = byId('refreshBtn')
const pageStatus = byId('pageStatus')
const emptyState = byId('emptyState')
const submissionList = byId('submissionList')
const connectionDot = byId('connectionDot')
const connectionText = byId('connectionText')

function escapeHtml (value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function fmtDate (value) {
  if (!value) return '—'

  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'

  return d.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function getBadgeClass (status) {
  if (status === 'failed') {
    return 'border-red-400/20 bg-red-500/10 text-red-200'
  }

  return 'border-amber-400/20 bg-amber-500/10 text-amber-200'
}

function updateConnectionBadge () {
  if (!connectionDot || !connectionText) return

  if (navigator.onLine) {
    connectionDot.className = 'h-2 w-2 rounded-full bg-emerald-300'
    connectionText.textContent = 'Online'
    return
  }

  connectionDot.className = 'h-2 w-2 rounded-full bg-amber-300'
  connectionText.textContent = 'Offline'
}

function getSummary (item) {
  const payload = item?.payload || {}

  return {
    customer: payload.customerName || 'Unknown customer',
    jobNumber: payload.jobNumber || 'No job #',
    refrigerant: payload.refrigerantType || 'Unknown refrigerant',
    equipment: payload.equipmentType || 'Unknown equipment',
    cityState: [payload.city, payload.state].filter(Boolean).join(', ') || '—',
    added:
      Number.isFinite(Number(payload.poundsAdded)) && payload.poundsAdded !== ''
        ? `${payload.poundsAdded} lb added`
        : '0 lb added',
    recovered:
      Number.isFinite(Number(payload.poundsRecovered)) &&
      payload.poundsRecovered !== ''
        ? `${payload.poundsRecovered} lb recovered`
        : '0 lb recovered',
    techName: payload.techName || 'Unknown tech',
    leakSuspected: payload.leakSuspected || '—'
  }
}

function payloadToDraft (payload = {}) {
  const addedTotal = Number(payload.poundsAdded || 0)
  const recoveredTotal = Number(payload.poundsRecovered || 0)

  const addedLbs = Math.floor(addedTotal)
  const recoveredLbs = Math.floor(recoveredTotal)

  const addedOz = Number(((addedTotal - addedLbs) * 16).toFixed(1))
  const recoveredOz = Number(((recoveredTotal - recoveredLbs) * 16).toFixed(1))

  return {
    refTech: payload.techName || '',
    refJobNumber: payload.jobNumber || '',
    refCustomer: payload.customerName || '',
    refCity: payload.city || '',
    refState: payload.state || '',
    refEquipmentType: payload.equipmentType || '',
    refRefrigerantType: payload.refrigerantType || '',
    refAddedLbs: String(addedLbs || 0),
    refAddedOz: String(addedOz || 0),
    refRecoveredLbs: String(recoveredLbs || 0),
    refRecoveredOz: String(recoveredOz || 0),
    refLeakSuspected: payload.leakSuspected || '',
    refNotes: payload.notes || ''
  }
}

async function postPayload (payload, endpoint = WEB_APP_URL) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok || data.ok !== true) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }

  return data
}

function buildCard (item) {
  const summary = getSummary(item)
  const status = item.status || 'queued'
  const retryCount = Number(item.retryCount || 0)

  return `
    <article
      class="rounded-2xl border border-white/10 bg-white/5 p-4"
      data-queue-id="${item.id}"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-base font-bold text-white">
            ${escapeHtml(summary.customer)}
          </div>
          <div class="mt-1 text-sm text-white/55">
            Job # ${escapeHtml(summary.jobNumber)}
          </div>
        </div>

        <div class="shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getBadgeClass(
          status
        )}">
          ${escapeHtml(status)}
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-2">
        <div class="rounded-xl border border-white/10 bg-neutral-900/70 px-3 py-2">
          <div class="text-[11px] uppercase tracking-wide text-white/45">Tech</div>
          <div class="mt-1 text-sm font-medium text-white">
            ${escapeHtml(summary.techName)}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-xl border border-white/10 bg-neutral-900/70 px-3 py-2">
            <div class="text-[11px] uppercase tracking-wide text-white/45">Equipment</div>
            <div class="mt-1 text-sm font-medium text-white">
              ${escapeHtml(summary.equipment)}
            </div>
          </div>

          <div class="rounded-xl border border-white/10 bg-neutral-900/70 px-3 py-2">
            <div class="text-[11px] uppercase tracking-wide text-white/45">Refrigerant</div>
            <div class="mt-1 text-sm font-medium text-white">
              ${escapeHtml(summary.refrigerant)}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-xl border border-white/10 bg-neutral-900/70 px-3 py-2">
            <div class="text-[11px] uppercase tracking-wide text-white/45">Added</div>
            <div class="mt-1 text-sm font-medium text-white">
              ${escapeHtml(summary.added)}
            </div>
          </div>

          <div class="rounded-xl border border-white/10 bg-neutral-900/70 px-3 py-2">
            <div class="text-[11px] uppercase tracking-wide text-white/45">Recovered</div>
            <div class="mt-1 text-sm font-medium text-white">
              ${escapeHtml(summary.recovered)}
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-white/10 bg-neutral-900/70 px-3 py-2">
          <div class="text-[11px] uppercase tracking-wide text-white/45">City / State</div>
          <div class="mt-1 text-sm font-medium text-white">
            ${escapeHtml(summary.cityState)}
          </div>
        </div>

        <div class="rounded-xl border border-white/10 bg-neutral-900/70 px-3 py-2">
          <div class="text-[11px] uppercase tracking-wide text-white/45">Leak Suspected</div>
          <div class="mt-1 text-sm font-medium text-white">
            ${escapeHtml(summary.leakSuspected)}
          </div>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/50">
        <span>Saved ${escapeHtml(fmtDate(item.createdAt))}</span>
        ${
          retryCount > 0
            ? `<span>• Retries ${escapeHtml(String(retryCount))}</span>`
            : ''
        }
      </div>

      ${
        item.lastError
          ? `
        <div class="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
          ${escapeHtml(item.lastError)}
        </div>
      `
          : ''
      }

      <div class="mt-4 flex flex-wrap gap-2">
  <button
    type="button"
    data-action="edit"
    data-queue-id="${item.id}"
    class="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/90"
  >
    Edit
  </button>

  <button
    type="button"
    data-action="retry"
    data-queue-id="${item.id}"
    class="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200"
  >
    Retry
  </button>

  <button
    type="button"
    data-action="delete"
    data-queue-id="${item.id}"
    class="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200"
  >
    Delete
  </button>
</div>
    </article>
  `
}

async function renderList () {
  clearStatus(pageStatus)
  updateConnectionBadge()

  const rows = await getQueuedSubmissions(MODULE_KEY)
  const sorted = [...rows]
    .sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime()
      const bTime = new Date(b.createdAt || 0).getTime()
      return bTime - aTime
    })
    .slice(0, 10)

  const queuedCount = rows.filter(row => row.status === 'queued').length
  const failedCount = rows.filter(row => row.status === 'failed').length

  if (queuedCountEl) queuedCountEl.textContent = String(queuedCount)
  if (failedCountEl) failedCountEl.textContent = String(failedCount)

  if (!submissionList || !emptyState) return

  if (!sorted.length) {
    submissionList.innerHTML = ''
    emptyState.classList.remove('hidden')
    return
  }

  emptyState.classList.add('hidden')
  submissionList.innerHTML = sorted.map(buildCard).join('')
}

async function retryAll () {
  if (!retryAllBtn) return

  retryAllBtn.disabled = true
  retryAllBtn.textContent = 'Retrying...'

  try {
    const result = await flushQueue({
      module: MODULE_KEY,
      submitFn: async item => {
        await postPayload(item.payload, item.endpoint || WEB_APP_URL)
      }
    })

    if (result.skipped) {
      showStatus(
        pageStatus,
        'Device is offline. Connect to the internet to retry syncing.',
        false
      )
    } else if (result.sent > 0 && result.failed === 0) {
      showStatus(
        pageStatus,
        `${result.sent} queued submission${
          result.sent === 1 ? '' : 's'
        } synced successfully.`
      )
    } else if (result.sent > 0 || result.failed > 0) {
      showStatus(
        pageStatus,
        `Sync finished. Sent: ${result.sent}. Failed: ${result.failed}.`,
        result.failed === 0
      )
    } else {
      showStatus(pageStatus, 'Nothing was waiting to sync.')
    }

    await renderList()
  } catch (err) {
    showStatus(
      pageStatus,
      `Retry failed. ${String(err?.message || err)}`,
      false
    )
  } finally {
    retryAllBtn.disabled = false
    retryAllBtn.textContent = 'Retry Sync'
  }
}

async function handleListClick (event) {
  const button = event.target.closest('button[data-action]')
  if (!button) return

  const action = button.dataset.action
  const id = Number(button.dataset.queueId)

  if (!Number.isFinite(id)) return
  if (action === 'edit') {
    const rows = await getQueuedSubmissions(MODULE_KEY)
    const item = rows.find(row => row.id === id)

    if (!item) {
      showStatus(pageStatus, 'That queue item was not found.', false)
      await renderList()
      return
    }

    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify(payloadToDraft(item.payload))
    )
    localStorage.setItem(STEP_KEY, '0')
    localStorage.setItem(EDIT_QUEUE_KEY, String(id))
    window.location.href = REFRIGERANT_FORM_URL
    return
  }
  if (action === 'delete') {
    const confirmed = window.confirm(
      'Delete this queued refrigerant log from local storage?'
    )
    if (!confirmed) return

    await removeQueuedSubmission(id)
    showStatus(pageStatus, 'Queued submission deleted.')
    await renderList()
    return
  }

  if (action === 'retry') {
    const rows = await getQueuedSubmissions(MODULE_KEY)
    const item = rows.find(row => row.id === id)

    if (!item) {
      showStatus(pageStatus, 'That queue item was not found.', false)
      await renderList()
      return
    }

    if (!navigator.onLine) {
      showStatus(
        pageStatus,
        'Device is offline. Connect to the internet to retry syncing.',
        false
      )
      return
    }

    button.disabled = true
    button.textContent = 'Retrying...'

    try {
      await postPayload(item.payload, item.endpoint || WEB_APP_URL)
      await removeQueuedSubmission(id)
      showStatus(pageStatus, 'Submission synced successfully.')
      await renderList()
    } catch (err) {
      showStatus(
        pageStatus,
        `Retry failed. ${String(err?.message || err)}`,
        false
      )
      await renderList()
    }
  }
}

retryAllBtn?.addEventListener('click', retryAll)
refreshBtn?.addEventListener('click', renderList)
submissionList?.addEventListener('click', handleListClick)

window.addEventListener('online', renderList)
window.addEventListener('offline', renderList)

renderList()
