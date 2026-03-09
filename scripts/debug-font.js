#!/usr/bin/env node
/**
 * Debug font pattern
 */

const fs = require('fs');

const content = fs.readFileSync('src/index.css', 'utf8');
const pattern = /font-family.*(?!Inter|system-ui|sans-serif|var\(--font)/g;

const matches = content.match(pattern);
console.log('Matches found:', matches);

if (matches) {
  matches.forEach((match, index) => {
    console.log(`Match ${index + 1}: "${match}"`);
    
    // Find the line number
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(match)) {
        console.log(`  Line ${i + 1}: ${lines[i].trim()}`);
      }
    }
  });
}