#!/usr/bin/env node
/**
 * Extract ATLAS Errors Only
 * Shows only the blocking errors, not warnings
 */

const { lintFile } = require('./atlas-lint.js');
const fs = require('fs');
const path = require('path');

function getAllFiles(dir, extensions = ['.tsx', '.ts', '.jsx', '.js', '.css']) {
  const files = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      // Skip exceptions
      if (fullPath.includes('node_modules') || 
          fullPath.includes('build') || 
          fullPath.includes('dist') ||
          fullPath.includes('.git')) {
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

function main() {
  console.log('🔍 ATLAS Error Extractor');
  console.log('========================');
  
  const srcDir = path.join(process.cwd(), 'src');
  const files = getAllFiles(srcDir);
  
  let totalErrors = 0;
  const errorFiles = [];
  
  for (const file of files) {
    const result = lintFile(file);
    
    if (result.errors && result.errors.length > 0) {
      totalErrors += result.errors.length;
      errorFiles.push({
        file: path.relative(process.cwd(), file),
        errors: result.errors
      });
    }
  }
  
  console.log(`\n❌ Found ${totalErrors} ERRORS in ${errorFiles.length} files:\n`);
  
  for (const { file, errors } of errorFiles) {
    console.log(`📄 ${file}`);
    
    for (const error of errors) {
      console.log(`  ❌ ${error.type}: ${error.message}`);
      console.log(`     Pattern: ${error.pattern}`);
      console.log(`     Matches: ${error.matches}`);
      console.log('');
    }
  }
  
  return totalErrors > 0 ? 1 : 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { main };