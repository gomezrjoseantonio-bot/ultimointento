#!/usr/bin/env node

const fs = require('fs');

const content = fs.readFileSync('src/index.css', 'utf8');

// Test different patterns
const patterns = [
  /font-family:\s*['"]*(?!Inter\b|system-ui\b|sans-serif\b|var\(--font)[^;]+/g,
  /font-family:\s*(?!Inter|system-ui|sans-serif|var\(--font)[^;]*/g,
  /font-family:[^;]*(?<!Inter|system-ui|sans-serif)/g
];

console.log('Content lines with font-family:');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('font-family')) {
    console.log(`Line ${i+1}: "${line.trim()}"`);
  }
});

console.log('\nTesting patterns:');
patterns.forEach((pattern, i) => {
  console.log(`\nPattern ${i+1}: ${pattern}`);
  const matches = content.match(pattern);
  console.log('Matches:', matches);
});

// Test what we want to allow vs block
const testCases = [
  'font-family: Inter, system-ui, sans-serif;', // Should be allowed
  'font-family: "Inter", system-ui, sans-serif;', // Should be allowed  
  'font-family: Arial, sans-serif;', // Should be blocked
  'font-family: "Helvetica Neue", sans-serif;' // Should be blocked
];

console.log('\nTesting specific cases:');
testCases.forEach(testCase => {
  const shouldBlock = /font-family:\s*(?!Inter\b|system-ui\b|sans-serif\b|var\(--font)[^;]+/.test(testCase);
  console.log(`"${testCase}" -> ${shouldBlock ? 'BLOCKED' : 'ALLOWED'}`);
});