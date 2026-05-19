const fs = require('fs');
const path = require('path');

const BAD_CLOSE = '</' + 'motion.div>';
const GOOD_CLOSE = '</' + 'motion.div>'.replace('motion.', '');
const BAD_OPEN = '<' + 'motion.div';
const GOOD_OPEN = '<' + 'motion.div'.replace('motion.', '');

function fixContent(s) {
  return s.split(BAD_CLOSE).join(GOOD_CLOSE).split(BAD_OPEN).join(GOOD_OPEN);
}

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(jsx|js|tsx|ts)$/.test(ent.name)) {
      const s = fs.readFileSync(p, 'utf8');
      const n = fixContent(s);
      if (n !== s) {
        fs.writeFileSync(p, n, 'utf8');
        console.log('fixed', p);
      }
    }
  }
}

walk(path.join(__dirname, '..', 'src'));
