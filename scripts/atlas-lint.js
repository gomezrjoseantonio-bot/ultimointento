#!/usr/bin/env node
/**
 * ATLAS Design System Linter
 * Validates compliance with ATLAS design system requirements
 * Fails build if non-compliant patterns are found
 */

const fs = require('fs');
const path = require('path');

// Patterns that should fail the build (per ATLAS requirements)
const FORBIDDEN_PATTERNS = {
  // Dark themes and overlays - ATLAS requires light themes only
  darkThemes: [
    /bg-black/g,
    /bg-opacity-50/g,
    /bg-opacity-60/g,
    /bg-opacity-70/g,
    /bg-opacity-80/g,
    /bg-opacity-90/g,
    /bg-gray-900/g,
    /bg-gray-800/g,
    /dark:/g,
    /className.*dark/g,
    /bg-opacity-\d+/g,  // Any bg-opacity class
  ],
  
  // Non-ATLAS colors (hardcoded hex values) - Exception for token definitions
  hardcodedColors: [
    /#[0-9A-Fa-f]{6}/g,  // Hex colors (should use tokens)
    /#[0-9A-Fa-f]{3}/g,  // Short hex colors
    /rgb\(/g,             // RGB colors
    /rgba\(/g,            // RGBA colors
    /hsl\(/g,             // HSL colors
    /hsla\(/g,            // HSLA colors
  ],
  
  // Forbidden color - #09182E specifically mentioned as prohibited
  prohibitedColors: [
    /#09182E/gi,
    /#091/gi,  // Short version
  ],
  
  // Non-Lucide icon imports - ATLAS requires Lucide only
  forbiddenIcons: [
    /@heroicons\/react/g,
    /from ['"]@heroicons/g,
    /import.*@heroicons/g,
    /from ['"]@material-ui/g,
    /import.*@material-ui/g,
    /from ['"]react-icons/g,
    /import.*react-icons/g,
    /from ['"]@mui\/icons/g,
    /import.*@mui\/icons/g,
  ],
  
  // Non-Inter fonts - ATLAS requires Inter only
  forbiddenFonts: [
    /font-family.*(?!Inter|system-ui|sans-serif|var\(--font)/g,
    /'Arial'(?!.*system-ui)/g,
    /'Helvetica'(?!.*system-ui)/g,
    /'Times'/g,
    /'Georgia'/g,
    /font-sans.*(?!Inter)/g,
  ],
  
  // Browser alerts - Should use ATLAS toast system
  browserAlerts: [
    /alert\(/g,
    /confirm\(/g,
    /prompt\(/g,
  ],
  
  // Help pattern violations - Must use ATLAS SUA patterns
  invalidHelp: [
    // Help text in H1/H2 (forbidden per requirements)
    /<h[12][^>]*>.*(?:ayuda|help|asistencia|soporte)/gi,
    // Loose help text not in approved patterns
    /className.*help.*text/g,
  ],
  
  // Non-ES locale formatting - Must use ES-ES format
  invalidLocale: [
    /toLocaleString\(['"](?!es-ES)/g,
    /new Intl\..*\(['"](?!es-ES)/g,
  ],
};

// Allowed exceptions (files that can be skipped)
const EXCEPTIONS = [
  'node_modules',
  'build',
  'dist',
  '.git',
  'package-lock.json',
  'atlas-lint.js', // This file itself
  'test.',
  'spec.',
  '.test.',
  '.spec.',
  'stories.'
];

function getAllFiles(dir, extensions = ['.tsx', '.ts', '.jsx', '.js', '.css']) {
  const files = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      // Skip exceptions
      if (EXCEPTIONS.some(exc => fullPath.includes(exc))) {
        continue;
      }
      
      if (stat.isDirectory()) {
        files.push(...getAllFiles(fullPath, extensions));
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dir}:`, error.message);
  }
  
  return files;
}

function lintFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const errors = [];
  const warnings = [];
  
  // Check for dark themes
  for (const pattern of FORBIDDEN_PATTERNS.darkThemes) {
    const matches = content.match(pattern);
    if (matches) {
      errors.push({
        type: 'DARK_THEME',
        pattern: pattern.toString(),
        matches: matches.length,
        message: 'Dark theme detected - ATLAS requires light themes only'
      });
    }
  }
  
  // Check for prohibited color #09182E
  for (const pattern of FORBIDDEN_PATTERNS.prohibitedColors) {
    const matches = content.match(pattern);
    if (matches) {
      errors.push({
        type: 'PROHIBITED_COLOR',
        pattern: pattern.toString(),
        matches: matches.length,
        message: 'Prohibited color #09182E detected - this color is forbidden in ATLAS'
      });
    }
  }
  
  // Check for hardcoded colors (but allow CSS custom properties and ATLAS token definitions)
  for (const pattern of FORBIDDEN_PATTERNS.hardcodedColors) {
    const matches = content.match(pattern);
    if (matches) {
      // Filter out CSS custom properties and allowed tokens
      const filteredMatches = matches.filter(match => 
        !match.includes('--') && 
        !match.includes('var(') &&
        // Allow specific ATLAS token values in comments or definitions
        !content.includes(`--atlas-blue: ${match}`) &&
        !content.includes(`--atlas-navy-1: ${match}`) &&
        !content.includes(`--atlas-navy-2: ${match}`) &&
        !content.includes(`--atlas-teal: ${match}`) &&
        !content.includes(`--ok: ${match}`) &&
        !content.includes(`--warn: ${match}`) &&
        !content.includes(`--error: ${match}`) &&
        !content.includes(`--bg: ${match}`) &&
        !content.includes(`--text-gray: ${match}`) &&
        // Allow in CSS files if it's a token definition
        !(filePath.endsWith('.css') && content.includes(`: ${match};`))
      );
      
      if (filteredMatches.length > 0) {
        warnings.push({
          type: 'HARDCODED_COLOR',
          pattern: pattern.toString(),
          matches: filteredMatches,
          message: 'Hardcoded color detected - should use ATLAS tokens'
        });
      }
    }
  }
  
  // Check for forbidden icon imports
  for (const pattern of FORBIDDEN_PATTERNS.forbiddenIcons) {
    const matches = content.match(pattern);
    if (matches) {
      errors.push({
        type: 'FORBIDDEN_ICONS',
        pattern: pattern.toString(),
        matches: matches.length,
        message: 'Non-Lucide icons detected - ATLAS requires Lucide only'
      });
    }
  }
  
  // Check for non-Inter fonts
  for (const pattern of FORBIDDEN_PATTERNS.forbiddenFonts) {
    const matches = content.match(pattern);
    if (matches) {
      warnings.push({
        type: 'FORBIDDEN_FONTS',
        pattern: pattern.toString(),
        matches: matches.length,
        message: 'Non-Inter font detected - ATLAS requires Inter with approved fallbacks only'
      });
    }
  }
  
  // Check for browser alerts
  for (const pattern of FORBIDDEN_PATTERNS.browserAlerts) {
    const matches = content.match(pattern);
    if (matches) {
      warnings.push({
        type: 'BROWSER_ALERT',
        pattern: pattern.toString(),
        matches: matches.length,
        message: 'Browser alert detected - should use ATLAS toast system'
      });
    }
  }
  
  // Check for invalid help patterns
  for (const pattern of FORBIDDEN_PATTERNS.invalidHelp) {
    const matches = content.match(pattern);
    if (matches) {
      errors.push({
        type: 'INVALID_HELP_PATTERN',
        pattern: pattern.toString(),
        matches: matches.length,
        message: 'Invalid help pattern - must use ATLAS SUA patterns (EmptyState, InlineHint, InfoTooltip, HelperBanner)'
      });
    }
  }
  
  // Check for non-ES locale formatting
  for (const pattern of FORBIDDEN_PATTERNS.invalidLocale) {
    const matches = content.match(pattern);
    if (matches) {
      warnings.push({
        type: 'INVALID_LOCALE',
        pattern: pattern.toString(),
        matches: matches.length,
        message: 'Non-ES locale detected - ATLAS requires es-ES formatting (1.234,56 €, DD/MM/AAAA)'
      });
    }
  }
  
  return { errors, warnings };
}

function main() {
  console.log('🔍 ATLAS Design System Linter');
  console.log('==============================');
  
  const srcDir = path.join(process.cwd(), 'src');
  const files = getAllFiles(srcDir);
  
  console.log(`Checking ${files.length} files...`);
  
  let totalErrors = 0;
  let totalWarnings = 0;
  const problemFiles = [];
  
  for (const file of files) {
    const { errors, warnings } = lintFile(file);
    
    if (errors.length > 0 || warnings.length > 0) {
      const relativePath = path.relative(process.cwd(), file);
      problemFiles.push({
        file: relativePath,
        errors,
        warnings
      });
      
      totalErrors += errors.length;
      totalWarnings += warnings.length;
    }
  }
  
  // Report results
  if (problemFiles.length === 0) {
    console.log('✅ All files pass ATLAS design system validation!');
    return 0;
  }
  
  console.log(`\n❌ Found ${totalErrors} errors and ${totalWarnings} warnings in ${problemFiles.length} files:\n`);
  
  for (const { file, errors, warnings } of problemFiles) {
    console.log(`📄 ${file}`);
    
    for (const error of errors) {
      console.log(`  🚨 ERROR: ${error.message}`);
      console.log(`     Pattern: ${error.pattern}`);
      console.log(`     Matches: ${error.matches}`);
    }
    
    for (const warning of warnings) {
      console.log(`  ⚠️  WARNING: ${warning.message}`);
      console.log(`     Pattern: ${warning.pattern}`);
      if (Array.isArray(warning.matches)) {
        console.log(`     Examples: ${warning.matches.slice(0, 3).join(', ')}`);
      } else {
        console.log(`     Matches: ${warning.matches}`);
      }
    }
    
    console.log('');
  }
  
  console.log('💡 To fix these issues:');
  console.log('  - Replace dark themes with ATLAS light themes');
  console.log('  - Use ATLAS color tokens instead of hardcoded colors');
  console.log('  - Import icons from lucide-react only');
  console.log('  - Replace browser alerts with ATLAS toast system');
  
  // Fail build if there are errors (warnings are allowed)
  if (totalErrors > 0) {
    console.log(`\n🛑 Build failed due to ${totalErrors} ATLAS compliance errors`);
    return 1;
  } else {
    console.log(`\n✅ No blocking errors found (${totalWarnings} warnings can be addressed later)`);
    return 0;
  }
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { main, lintFile };