#!/usr/bin/env node
/**
 * Final Color Cleanup Script
 * Handles remaining edge cases and specific color patterns
 */

const fs = require('fs');
const path = require('path');

// Final cleanup mappings for specific remaining cases
const FINAL_MAPPINGS = {
  // Hover states
  'hover:text-[#1a365d]': 'hover:text-primary-800',
  'hover:text-[#B91C1C]': 'hover:text-error-700',
  'hover:text-[#033A73]': 'hover:text-primary-800',
  
  // Text colors
  'text-[#0B2B5C]': 'text-primary-700',
  'text-[#0369A1]': 'text-info-700',
  'text-[#D97706]': 'text-warning-600',
  'text-[#1D4ED8]': 'text-info-600',
  
  // Background colors
  'bg-[#FEF3C7]': 'bg-warning-100',
  'bg-[#DBEAFE]': 'bg-info-100',
  
  // Legacy hover states and other edge cases
  'text-[#022D5E]': 'text-primary-700',
  'bg-[#022D5E]': 'bg-primary-700',
  'border-[#022D5E]': 'border-primary-700',
  'from-[#022D5E]': 'from-primary-700',
  'to-[#022D5E]': 'to-primary-700',
};

function cleanupFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changes = 0;
  const originalContent = content;
  
  for (const [oldPattern, newPattern] of Object.entries(FINAL_MAPPINGS)) {
    const regex = new RegExp(oldPattern.replace(/([.*+?^${}()|[\]\\])/g, '\\$1'), 'g');
    const newContent = content.replace(regex, newPattern);
    if (newContent !== content) {
      const matches = (content.match(regex) || []).length;
      changes += matches;
      console.log(`  ${path.basename(filePath)}: ${oldPattern} → ${newPattern} (${matches} replacements)`);
      content = newContent;
    }
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
  
  return changes;
}

function getAllFiles(dir) {
  let files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      files = files.concat(getAllFiles(fullPath));
    } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function main() {
  const srcDir = path.join(process.cwd(), 'src');
  console.log('🎨 Final color cleanup...');
  
  const files = getAllFiles(srcDir);
  let totalChanges = 0;
  let filesChanged = 0;
  
  for (const file of files) {
    const changes = cleanupFile(file);
    if (changes > 0) {
      filesChanged++;
      totalChanges += changes;
    }
  }
  
  console.log('\n✨ Final cleanup complete!');
  console.log(`📊 Summary: ${filesChanged} files changed, ${totalChanges} total replacements`);
}

if (require.main === module) {
  main();
}