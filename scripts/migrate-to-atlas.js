const fs = require('fs');
const path = require('path');
const glob = require('glob');

const replacements = [
  // Colors - Text
  { from: /text-gray-500/g, to: 'text-text-gray' },
  { from: /text-gray-600/g, to: 'text-atlas-navy-1' },
  { from: /text-gray-700/g, to: 'text-atlas-navy-1' },
  { from: /text-blue-600/g, to: 'text-atlas-blue' },
  { from: /text-green-600/g, to: 'text-ok' },
  { from: /text-red-600/g, to: 'text-error' },
  { from: /text-yellow-600/g, to: 'text-warn' },

  // Backgrounds
  { from: /bg-gray-50/g, to: 'bg-bg' },
  { from: /bg-blue-50/g, to: 'bg-primary-50' },
  { from: /bg-blue-600/g, to: 'bg-atlas-blue' },
  { from: /bg-green-50/g, to: 'bg-ok-50' },
  { from: /bg-red-50/g, to: 'bg-error-50' },

  // Borders
  { from: /border-blue-600/g, to: 'border-atlas-blue' },
];

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  replacements.forEach(({ from, to }) => {
    if (from.test(content)) {
      content = content.replace(from, to);
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Migrated: ${filePath}`);
  }
}

const files = glob.sync('src/**/*.{tsx,ts,jsx,js}', {
  ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
});

console.log(`Found ${files.length} files to process...`);

files.forEach(migrateFile);

console.log('\n✨ Migration complete!');
