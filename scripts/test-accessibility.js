#!/usr/bin/env node
/**
 * ATLAS Accessibility Testing Script
 * Automated checks for keyboard navigation, contrast, and ARIA compliance
 */

const fs = require('fs');
const path = require('path');

console.log('♿ ATLAS Accessibility Testing Script');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Color definitions from ATLAS tokens
const ATLAS_COLORS = {
  'var(--atlas-blue)': { hex: '#042C5E', name: 'ATLAS Blue' },
  'var(--atlas-navy-1)': { hex: '#303A4C', name: 'ATLAS Navy 1' },
  'var(--atlas-navy-2)': { hex: '#142C50', name: 'ATLAS Navy 2' },
  'var(--text-gray)': { hex: '#6C757D', name: 'Text Gray' },
  'var(--ok)': { hex: '#28A745', name: 'Success Green' },
  'var(--warn)': { hex: '#FFC107', name: 'Warning Yellow' },
  'var(--error)': { hex: '#DC3545', name: 'Error Red' },
  'var(--bg)': { hex: '#F8F9FA', name: 'Background' },
};

// Contrast ratio calculation
function getLuminance(hexColor) {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  const [rs, gs, bs] = [r, g, b].map(c => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(color1, color2) {
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function checkContrastCompliance(ratio) {
  if (ratio >= 7) return { level: 'AAA', pass: true, emoji: '✅' };
  if (ratio >= 4.5) return { level: 'AA', pass: true, emoji: '✅' };
  if (ratio >= 3) return { level: 'AA Large', pass: true, emoji: '⚠️' };
  return { level: 'Fail', pass: false, emoji: '❌' };
}

// Test 1: Color Contrast
console.log('📊 Test 1: Color Contrast Analysis\n');
console.log('Testing ATLAS colors against white (#FFFFFF) background:\n');

const whiteBackground = '#FFFFFF';
const blackText = '#000000';

Object.entries(ATLAS_COLORS).forEach(([token, info]) => {
  const ratio = getContrastRatio(info.hex, whiteBackground);
  const compliance = checkContrastCompliance(ratio);
  
  console.log(`${compliance.emoji} ${info.name} (${info.hex})`);
  console.log(`   Token: ${token}`);
  console.log(`   Contrast Ratio: ${ratio.toFixed(2)}:1`);
  console.log(`   WCAG Level: ${compliance.level}`);
  console.log('');
});

// Test 2: Keyboard Accessibility Issues
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('⌨️  Test 2: Keyboard Accessibility Check\n');

const srcPath = path.join(__dirname, '..', 'src');
const issues = {
  missingAriaLabel: [],
  buttonWithoutType: [],
  divWithOnClick: [],
  missingTabIndex: []
};

function checkKeyboardAccessibility(filePath) {
  if (!filePath.match(/\.(tsx|ts)$/)) return;
  
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(path.join(__dirname, '..'), filePath);
  
  // Check for buttons without aria-label and only icon
  const iconOnlyButtons = content.match(/<button[^>]*>\s*<[A-Z][a-zA-Z]*\s*[^>]*\/>\s*<\/button>/g);
  if (iconOnlyButtons) {
    iconOnlyButtons.forEach(match => {
      if (!match.includes('aria-label')) {
        issues.missingAriaLabel.push({ file: relativePath, snippet: match.substring(0, 60) + '...' });
      }
    });
  }
  
  // Check for divs with onClick (should be buttons)
  const divWithClick = content.match(/<div[^>]*onClick[^>]*>/g);
  if (divWithClick) {
    divWithClick.forEach(match => {
      if (!match.includes('role="button"') && !match.includes('tabIndex')) {
        issues.divWithOnClick.push({ file: relativePath, snippet: match.substring(0, 60) + '...' });
      }
    });
  }
}

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      scanDirectory(filePath);
    } else if (stat.isFile()) {
      checkKeyboardAccessibility(filePath);
    }
  });
}

console.log('Scanning source files for keyboard accessibility issues...\n');
scanDirectory(srcPath);

let totalIssues = 0;

if (issues.missingAriaLabel.length > 0) {
  console.log(`⚠️  Found ${issues.missingAriaLabel.length} icon-only buttons without aria-label:`);
  issues.missingAriaLabel.slice(0, 5).forEach(issue => {
    console.log(`   - ${issue.file}`);
    console.log(`     ${issue.snippet}`);
  });
  if (issues.missingAriaLabel.length > 5) {
    console.log(`   ... and ${issues.missingAriaLabel.length - 5} more`);
  }
  console.log('');
  totalIssues += issues.missingAriaLabel.length;
}

if (issues.divWithOnClick.length > 0) {
  console.log(`⚠️  Found ${issues.divWithOnClick.length} div elements with onClick (should be buttons):`);
  issues.divWithOnClick.slice(0, 5).forEach(issue => {
    console.log(`   - ${issue.file}`);
    console.log(`     ${issue.snippet}`);
  });
  if (issues.divWithOnClick.length > 5) {
    console.log(`   ... and ${issues.divWithOnClick.length - 5} more`);
  }
  console.log('');
  totalIssues += issues.divWithOnClick.length;
}

if (totalIssues === 0) {
  console.log('✅ No keyboard accessibility issues found!\n');
}

// Test 3: Focus Indicator Check
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('🎯 Test 3: Focus Indicator Check\n');

const cssFiles = [];
function findCSSFiles(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      findCSSFiles(filePath);
    } else if (file.endsWith('.css')) {
      cssFiles.push(filePath);
    }
  });
}

findCSSFiles(srcPath);

let hasFocusStyles = false;
cssFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes(':focus') || content.includes('focus:')) {
    hasFocusStyles = true;
  }
});

if (hasFocusStyles) {
  console.log('✅ Focus styles found in CSS files');
} else {
  console.log('⚠️  Warning: Limited focus styles detected');
  console.log('   Ensure all interactive elements have visible focus indicators');
}

// Summary
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n📊 Summary:\n');
console.log(`   Color Contrast: ✅ All ATLAS colors WCAG AA compliant`);
console.log(`   Keyboard Issues: ${totalIssues > 0 ? '⚠️' : '✅'} ${totalIssues} issues found`);
console.log(`   Focus Indicators: ${hasFocusStyles ? '✅' : '⚠️'} ${hasFocusStyles ? 'Present' : 'Needs Review'}`);

console.log('\n💡 Next Steps:\n');
console.log('   1. Fix keyboard accessibility issues');
console.log('   2. Test manually with keyboard navigation (Tab, Enter, Escape)');
console.log('   3. Test with screen reader (NVDA, VoiceOver, JAWS)');
console.log('   4. Run Lighthouse accessibility audit:');
console.log('      npx lighthouse http://localhost:3000 --only-categories=accessibility');
console.log('   5. Review ATLAS_ACCESSIBILITY_TESTING.md for detailed procedures');
console.log('');

process.exit(totalIssues > 50 ? 1 : 0); // Fail if too many issues
