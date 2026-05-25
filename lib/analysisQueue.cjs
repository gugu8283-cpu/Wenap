/**
 * In-process queue: max 3 concurrent analysis pipelines.
 */
const MAX_CONCURRENT = 3;
const MAX_QUEUE_WAIT_MS = 30_000;
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

  return new Promise((resolve) => {
    const poll = () => {
      if (Date.now() - enqueuedAt > MAX_QUEUE_WAIT_MS) {
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
