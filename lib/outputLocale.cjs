/** Normalize client locale for prompts and UI. */
function normalizeLocale(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  if (s.startsWith('zh-tw') || s.startsWith('zh-hk') || s === 'zh-hant') return 'zh-TW';
  if (s.startsWith('zh')) return 'zh-CN';
  if (s.startsWith('ja')) return 'ja';
  if (s.startsWith('ko')) return 'ko';
  if (s.startsWith('de')) return 'de';
  if (s.startsWith('fr')) return 'fr';
  if (s.startsWith('en')) return 'en';
  return 'zh-CN';
}

const LABELS = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  de: 'Deutsch',
  fr: 'français',
};

function outputLanguageInstruction(locale) {
  const loc = normalizeLocale(locale);
  const name = LABELS[loc] || LABELS['zh-CN'];
  return `
【输出语言】面向用户的文本（summary、dimensions[].note、detailAnalysis、outlook、disclaimer、supplyChain 的 name/relation、scenarios 的 trigger 等）必须使用${name}撰写。
JSON 键名不变；signal 仍为 BUY | HOLD | SELL；risk 仍用 高 | 中 | 低 三字（勿译成英文）。`;
}

module.exports = { normalizeLocale, outputLanguageInstruction, LABELS };
