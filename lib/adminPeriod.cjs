/** Admin dashboard period grouping (SQLite strftime). */

const PERIODS = ['day', 'week', 'month', 'quarter', 'year'];

function normalizePeriod(p) {
  const v = String(p || 'month').toLowerCase();
  return PERIODS.includes(v) ? v : 'month';
}

function periodGroupExpr(dateCol, period) {
  const col = dateCol || 'created_at';
  switch (normalizePeriod(period)) {
    case 'day':
      return `strftime('%Y-%m-%d', ${col})`;
    case 'week':
      return `strftime('%Y-W%W', ${col})`;
    case 'month':
      return `strftime('%Y-%m', ${col})`;
    case 'quarter':
      return `strftime('%Y', ${col}) || '-Q' || ((CAST(strftime('%m', ${col}) AS INTEGER) - 1) / 3 + 1)`;
    case 'year':
      return `strftime('%Y', ${col})`;
    default:
      return `strftime('%Y-%m', ${col})`;
  }
}

function defaultRange(period) {
  const to = new Date();
  const from = new Date(to);
  switch (normalizePeriod(period)) {
    case 'day':
      from.setUTCDate(from.getUTCDate() - 30);
      break;
    case 'week':
      from.setUTCDate(from.getUTCDate() - 84);
      break;
    case 'month':
      from.setUTCMonth(from.getUTCMonth() - 12);
      break;
    case 'quarter':
      from.setUTCMonth(from.getUTCMonth() - 24);
      break;
    case 'year':
      from.setUTCFullYear(from.getUTCFullYear() - 5);
      break;
    default:
      from.setUTCMonth(from.getUTCMonth() - 12);
  }
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function resolveRange({ period, from, to } = {}) {
  const p = normalizePeriod(period);
  const def = defaultRange(p);
  const f = String(from || '').slice(0, 10) || def.from;
  const t = String(to || '').slice(0, 10) || def.to;
  return { period: p, from: f, to: t };
}

module.exports = {
  PERIODS,
  normalizePeriod,
  periodGroupExpr,
  defaultRange,
  resolveRange,
};
