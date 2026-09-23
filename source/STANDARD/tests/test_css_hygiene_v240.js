const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'calendar', 'calendar.css'), 'utf8');
if (css.includes('\\n') || css.includes('\\r')) {
  throw new Error('calendar.css contains literal escaped-newline tokens');
}
if (!css.includes('/* V2.01 comfort functions */')) {
  throw new Error('calendar.css comfort-functions block missing after newline normalization');
}
console.log('V2.40 CSS source hygiene contract passed');
