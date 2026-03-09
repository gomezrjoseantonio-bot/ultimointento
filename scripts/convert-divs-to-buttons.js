#!/usr/bin/env node
/**
 * Convert div elements with onClick to proper button elements
 * Addresses WCAG 2.1 - 4.1.2 Name, Role, Value (semantic HTML)
 */

const fs = require('fs');
const path = require('path');

function convertDivToButton(fileContent, filePath) {
  let modified = false;
  let count = 0;
  
  // Match div elements with onClick
  const divOnClickRegex = /<div\s+([^>]*?)onClick=\{([^}]+)\}([^>]*?)>([\s\S]*?)<\/div>/g;
  
  let result = fileContent.replace(divOnClickRegex, (match, beforeOnClick, onClickHandler, afterOnClick, content) => {
    // Skip if already has role="button" or is actually not interactive
    const fullAttributes = beforeOnClick + afterOnClick;
    if (fullAttributes.includes('role="button"') || fullAttributes.includes("role='button'")) {
      return match; // Already has button role
    }
    
    // Skip if it's a container with other interactive elements
    if (content.includes('<button') || content.includes('<a ')) {
      return match; // Contains other interactive elements
    }
    
    // Check if has cursor-pointer or similar interactive styling
    const isInteractive = fullAttributes.includes('cursor-pointer') || 
                          fullAttributes.includes('hover:') ||
                          onClickHandler.trim().length > 0;
    
    if (!isInteractive) {
      return match; // Not clearly interactive
    }
    
    // Extract className
    const classMatch = fullAttributes.match(/className=(?:{([^}]+)}|"([^"]+)"|'([^']+)')/);
    let className = '';
    if (classMatch) {
      className = classMatch[1] || classMatch[2] || classMatch[3] || '';
    }
    
    // Detect if should be a button with ATLAS class or a simple button
    let buttonClass = className;
    
    // If it looks like a button (has bg color, border, padding), suggest ATLAS class
    if (className.includes('bg-') && !className.includes('atlas-btn-')) {
      // Try to detect type from color
      if (className.includes('bg-blue') || className.includes('bg-primary')) {
        buttonClass = `atlas-btn-primary ${className.replace(/bg-\w+-\d+/g, '').trim()}`;
      } else if (className.includes('bg-red') || className.includes('bg-danger')) {
        buttonClass = `atlas-btn-destructive ${className.replace(/bg-\w+-\d+/g, '').trim()}`;
      } else if (className.includes('bg-green') || className.includes('bg-success')) {
        buttonClass = `atlas-btn-success ${className.replace(/bg-\w+-\d+/g, '').trim()}`;
      } else if (className.includes('border-') && className.includes('bg-transparent')) {
        buttonClass = `atlas-btn-secondary ${className.replace(/border-\w+-\d+|bg-transparent/g, '').trim()}`;
      } else {
        // Keep original classes, just add button role via type
        buttonClass = className;
      }
    } else if (className.includes('hover:bg-') && !className.includes('bg-')) {
      // Ghost button style
      buttonClass = `atlas-btn-ghost ${className}`;
    }
    
    // Clean up className
    buttonClass = buttonClass.replace(/\s+/g, ' ').trim();
    
    // Build button attributes
    let buttonAttrs = '';
    if (buttonClass) {
      buttonAttrs += ` className="${buttonClass}"`;
    }
    
    // Add other attributes (excluding className and div-specific ones)
    const otherAttrs = fullAttributes
      .replace(/className=(?:{[^}]+}|"[^"]+"|'[^']+')/g, '')
      .replace(/cursor-pointer/g, '')
      .trim();
    
    if (otherAttrs) {
      buttonAttrs += ' ' + otherAttrs;
    }
    
    modified = true;
    count++;
    
    return `<button${buttonAttrs} onClick={${onClickHandler}}>${content}</button>`;
  });
  
  return { content: result, modified, count };
}

function processFile(filePath, dryRun = false) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    return { file: filePath, error: 'File not found' };
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  const result = convertDivToButton(content, filePath);
  
  if (result.modified && !dryRun) {
    fs.writeFileSync(fullPath, result.content, 'utf8');
  }
  
  return {
    file: filePath,
    count: result.count,
    modified: result.modified
  };
}

function findFilesWithDivOnClick() {
  const { execSync } = require('child_process');
  const srcPath = path.join(__dirname, '..', 'src');
  
  try {
    const output = execSync(
      `grep -rl "div.*onClick" ${srcPath} --include="*.tsx" --include="*.ts" || true`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    
    return output
      .split('\n')
      .filter(Boolean)
      .map(f => path.relative(path.join(__dirname, '..'), f));
  } catch (error) {
    console.error('Error finding files:', error.message);
    return [];
  }
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limit = args.find(a => a.startsWith('--limit='))?.split('=')[1];

console.log('🔄 Convert div onClick to Button Elements');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (dryRun) {
  console.log('🔍 DRY RUN MODE - No files will be modified\n');
}

console.log('Finding files with div onClick patterns...\n');
let files = findFilesWithDivOnClick();

if (limit) {
  const limitNum = parseInt(limit, 10);
  console.log(`⚠️  Limiting to first ${limitNum} files\n`);
  files = files.slice(0, limitNum);
}

console.log(`Found ${files.length} files to process\n`);

let totalConversions = 0;
let filesModified = 0;

files.forEach(file => {
  const result = processFile(file, dryRun);
  
  if (result.count > 0) {
    filesModified++;
    totalConversions += result.count;
    console.log(`✓ ${file} (${result.count} div(s) converted)`);
  }
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`\n📊 Summary:`);
console.log(`   Files processed: ${files.length}`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Total conversions: ${totalConversions}`);

if (dryRun) {
  console.log('\n💡 Run without --dry-run to apply changes');
} else if (filesModified > 0) {
  console.log('\n✅ Divs converted to semantic buttons!');
  console.log('\n💡 Next steps:');
  console.log('   1. Review changes with: git diff');
  console.log('   2. Test interactive elements');
  console.log('   3. Run accessibility test: npm run test:accessibility');
  console.log('   4. Verify keyboard navigation works');
} else {
  console.log('\n✨ No divs needed conversion!');
}

console.log('');
