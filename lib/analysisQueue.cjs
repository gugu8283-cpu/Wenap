/**
 * In-process queue: max 3 concurrent analysis pipelines.
 */
const MAX_CONCURRENT = 3;
function maxQueueWaitMs() {
  const raw = String(process.env.WENAP_ANALYSIS_QUEUE_MAX_MS ?? '0').trim();
  const n = Number.parseInt(raw, 10);
  if (raw === '0' || n === 0) return 0;
  if (Number.isFinite(n) && n > 0) return Math.min(n, 600_000);
  return 0;
}
const QUEUE_USER_MSG =
  "We're experiencing high demand. Your analysis will begin shortly...";
const QUEUE_TIMEOUT_MSG =
  "We're experiencing high demand. Please try again in a few minutes.";

let active = 0;

function logQueue(event, detail) {
  console.warn(`[Wenap] analysis-queue ${event} @ ${new Date().toISOString()} ${active} active — ${detail}`);
}

/**
 * @returns {Promise<{ queued: boolean, timedOut: boolean }>}
 */
function acquireAnalysisSlot() {
  if (active < MAX_CONCURRENT) {
    active += 1;
    logQueue('acquired', 'immediate');
    return Promise.resolve({ queued: false, timedOut: false });
  }

  const enqueuedAt = Date.now();
  logQueue('enqueue', 'waiting');

  const maxWait = maxQueueWaitMs();

  return new Promise((resolve) => {
    const poll = () => {
      if (maxWait > 0 && Date.now() - enqueuedAt > maxWait) {
        logQueue('timeout', `waitMs=${Date.now() - enqueuedAt}`);
        resolve({ queued: true, timedOut: true });
        return;
      }
      if (active < MAX_CONCURRENT) {
        active += 1;
        logQueue('dequeued', `waitMs=${Date.now() - enqueuedAt}`);
        resolve({ queued: true, timedOut: false });
        return;
      }
      setTimeout(poll, 200);
    };
    setTimeout(poll, 200);
  });
}

function releaseAnalysisSlot() {
  active = Math.max(0, active - 1);
  logQueue('released', '');
}

module.exports = {
  QUEUE_USER_MSG,
  QUEUE_TIMEOUT_MSG,
  acquireAnalysisSlot,
  releaseAnalysisSlot,
};
