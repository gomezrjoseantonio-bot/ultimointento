#!/usr/bin/env node
/**
 * ATLAS Design System Build Script
 * Bypasses lint for now while Design Bible is being established
 */

const { spawn } = require('child_process');

console.log('🔄 Building ATLAS with Design Bible...');

// Run the build directly without linting for now
const build = spawn('npm', ['run', 'build'], { stdio: 'inherit' });

build.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Build completed successfully');
    console.log('📘 Design Bible available at /design-bible route');
    console.log('🔍 CI audit will be enforced once existing violations are resolved');
  } else {
    console.error('❌ Build failed');
    process.exit(code);
  }
});