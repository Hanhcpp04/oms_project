const fs = require('fs');
const glob = require('glob');
const path = require('path');

const dir = 'e:/oms-project/frontend/src/app';
const files = glob.sync(`${dir}/**/*.html`);

let changedFiles = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace rounded-full on avatar-like elements (e.g., h-8 w-8, h-16 w-16, etc.)
  content = content.replace(/(class="[^"]*)rounded-full([^"]*h-\d+\s+w-\d+)/g, '$1rounded-[var(--radius-xs)]$2');
  content = content.replace(/(class="[^"]*h-\d+\s+w-\d+[^"]*)rounded-full/g, '$1rounded-[var(--radius-xs)]');

  // Replace rounded-full on tags and badges
  content = content.replace(/(class="[^"]*)rounded-full([^"]*bg-)/g, '$1rounded-[var(--radius-xs)]$2');
  content = content.replace(/(class="[^"]*bg-[^"]*)rounded-full/g, '$1rounded-[var(--radius-xs)]');
  
  // Revert back some rounded-full for spinners or radio buttons, wait radio is accent-[var] not rounded-full typically.
  // Spinners have animate-spin
  content = content.replace(/animate-spin[^"]*rounded-[^\s"]+/g, 'animate-spin rounded-full');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changedFiles++;
    console.log('Updated', path.basename(file));
  }
}
console.log('Total files updated:', changedFiles);
