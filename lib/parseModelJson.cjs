/** Extract and parse a JSON object from LLM output with light repair. */
function stripCodeFence(text) {
  let t = String(text || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return t.trim();
}

function findJsonObjectSlice(text) {
  const t = stripCodeFence(text);
  const start = t.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;

  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end >= start) return t.slice(start, end + 1);

  // Truncated output: take from first { and try to close braces later
  return t.slice(start);
}

function repairJsonText(raw) {
  let t = String(raw || '');
  t = t.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");
  t = t.replace(/,\s*([}\]])/g, '$1');
  t = t.replace(/\t/g, ' ');
  return t;
}

function closeTruncatedJson(raw) {
  let t = String(raw || '').trim();
  let depth = 0;
  let inStr = false;
  let esc = false;
  const stack = [];

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === '{' || c === '[') {
      stack.push(c);
      depth += 1;
    } else if (c === '}' || c === ']') {
      if (stack.length) stack.pop();
      depth = Math.max(0, depth - 1);
    }
  }

  if (inStr) t += '"';
  while (stack.length) {
    const open = stack.pop();
    t += open === '[' ? ']' : '}';
  }
  return t;
}

function extractJsonObject(text) {
  const slice = findJsonObjectSlice(text);
  if (!slice) throw new Error('响应中无 JSON 对象');

  const attempts = [slice, repairJsonText(slice), closeTruncatedJson(repairJsonText(slice))];

  let lastErr = null;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (e) {
      lastErr = e;
    }
  }

  const msg = lastErr?.message || 'JSON 解析失败';
  throw new Error(msg);
}

module.exports = { extractJsonObject, findJsonObjectSlice, repairJsonText };
