/**
 * Derive stable headline score from six dimension scores (after alignment).
 */

function reconcileHeadlineScore(data) {
  if (!data || typeof data !== 'object') return;
  const dims = Array.isArray(data.dimensions) ? data.dimensions : [];
  const usable = dims.filter((d) => {
    if (!d || typeof d !== 'object') return false;
    if (d.scoreUnavailable) return false;
    const sc = Number(d.score);
    return Number.isFinite(sc) && sc > 0;
  });
  if (usable.length < 4) return;

  const scores = usable.map((d) => Number(d.score));
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const computed = Math.min(100, Math.max(0, Math.round(avg)));
  const model = Number(data.score);
  if (!Number.isFinite(model)) {
    data.score = computed;
    return;
  }
  // Pull headline score toward dimension average to reduce run-to-run drift.
  data.score = Math.min(100, Math.max(0, Math.round(computed * 0.75 + model * 0.25)));
}

module.exports = { reconcileHeadlineScore };
