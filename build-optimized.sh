#!/bin/bash

# ATLAS Performance Build Script
# Runs optimized build with performance enhancements

echo "🚀 Starting ATLAS performance-optimized build..."

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf build/

# Build with optimizations
echo "⚙️ Building with React optimizations..."
export GENERATE_SOURCEMAP=false
export REACT_APP_PERFORMANCE_MODE=true
npm run build

# Check if build succeeded
if [ $? -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi

# Extract critical CSS
echo "🎨 Extracting critical CSS..."
node scripts/extractCriticalCSS.js

# Bundle analysis
echo "📊 Analyzing bundle..."
node scripts/bundleOptimizer.js

# Generate performance report
echo "📈 Generating performance report..."
node scripts/performanceOptimizer.js

echo "✅ Performance-optimized build completed!"
echo "📁 Build output: ./build/"
echo "🎯 Next steps:"
echo "   - Test with: npx serve build"
echo "   - Deploy optimized build to production"
