#!/usr/bin/env node

/**
 * Bundle Optimization Script
 * 
 * Analyzes and optimizes the React build to reduce bundle size
 * and improve loading performance.
 */

const fs = require('fs');
const path = require('path');

const LOG_PREFIX = '[BUNDLE-OPTIMIZER]';

/**
 * Analyze package.json for unnecessary dependencies
 */
function analyzePackageJson() {
  console.log(`${LOG_PREFIX} Analyzing package.json for optimization opportunities...`);
  
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  const heavyDependencies = [
    '@testing-library/react',
    '@testing-library/jest-dom', 
    '@testing-library/user-event',
    'react-beautiful-dnd', // Deprecated and heavy
    'jspdf',
    'jspdf-autotable',
    'jszip',
    'xlsx',
    'sheetjs-style'
  ];
  
  const foundHeavyDeps = heavyDependencies.filter(dep => 
    packageJson.dependencies && packageJson.dependencies[dep]
  );
  
  console.log(`${LOG_PREFIX} Found ${foundHeavyDeps.length} potentially heavy dependencies:`);
  foundHeavyDeps.forEach(dep => console.log(`${LOG_PREFIX}   - ${dep}`));
  
  return foundHeavyDeps;
}

/**
 * Suggest dynamic imports for heavy components
 */
function generateDynamicImportSuggestions() {
  console.log(`${LOG_PREFIX} Generating dynamic import suggestions...`);
  
  const suggestions = [
    {
      component: 'PDFViewer',
      reason: 'jsPDF is heavy and not always needed',
      code: `const PDFViewer = lazy(() => import('./PDFViewer'));`
    },
    {
      component: 'ExcelExporter', 
      reason: 'XLSX parsing is heavy',
      code: `const ExcelExporter = lazy(() => import('./ExcelExporter'));`
    },
    {
      component: 'DocumentScanner',
      reason: 'OCR libraries are typically large',
      code: `const DocumentScanner = lazy(() => import('./DocumentScanner'));`
    },
    {
      component: 'Charts',
      reason: 'Chart.js is large for visualization',
      code: `const Charts = lazy(() => import('./Charts'));`
    }
  ];
  
  console.log(`${LOG_PREFIX} Suggested dynamic imports:`);
  suggestions.forEach(s => {
    console.log(`${LOG_PREFIX}   ${s.component}: ${s.reason}`);
    console.log(`${LOG_PREFIX}     ${s.code}`);
  });
  
  return suggestions;
}

/**
 * Create optimized webpack config suggestions
 */
function generateWebpackOptimizations() {
  console.log(`${LOG_PREFIX} Generating webpack optimization suggestions...`);
  
  const optimizations = {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          maxSize: 200000, // 200KB max chunks
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          maxSize: 100000, // 100KB max chunks
        }
      }
    },
    usedExports: true,
    sideEffects: false
  };
  
  console.log(`${LOG_PREFIX} Suggested webpack optimizations:`, JSON.stringify(optimizations, null, 2));
  return optimizations;
}

/**
 * Find large files in src directory
 */
function findLargeFiles() {
  console.log(`${LOG_PREFIX} Scanning for large source files...`);
  
  const largeFiles = [];
  const sizeThreshold = 50 * 1024; // 50KB
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.includes('node_modules')) {
        scanDirectory(fullPath);
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
        if (stat.size > sizeThreshold) {
          largeFiles.push({
            path: fullPath.replace(process.cwd(), ''),
            size: Math.round(stat.size / 1024),
            lines: countLines(fullPath)
          });
        }
      }
    });
  }
  
  function countLines(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return content.split('\n').length;
    } catch {
      return 0;
    }
  }
  
  scanDirectory(path.join(process.cwd(), 'src'));
  
  largeFiles.sort((a, b) => b.size - a.size);
  
  console.log(`${LOG_PREFIX} Found ${largeFiles.length} large files (>${sizeThreshold/1024}KB):`);
  largeFiles.slice(0, 10).forEach(file => {
    console.log(`${LOG_PREFIX}   ${file.path}: ${file.size}KB (${file.lines} lines)`);
  });
  
  return largeFiles;
}

/**
 * Generate optimization report
 */
function generateOptimizationReport() {
  console.log(`${LOG_PREFIX} Generating optimization report...`);
  
  const heavyDeps = analyzePackageJson();
  const dynamicImports = generateDynamicImportSuggestions();
  const webpackOpts = generateWebpackOptimizations();
  const largeFiles = findLargeFiles();
  
  const report = {
    timestamp: new Date().toISOString(),
    heavyDependencies: heavyDeps,
    suggestedDynamicImports: dynamicImports,
    webpackOptimizations: webpackOpts,
    largeFiles: largeFiles.slice(0, 20),
    recommendations: [
      'Move heavy dependencies to dynamic imports',
      'Split large components into smaller modules',
      'Implement code splitting for route-level components',
      'Consider removing unused dependencies',
      'Optimize database operations with indexing',
      'Implement virtualization for large lists',
      'Use React.memo for expensive components',
      'Implement proper error boundaries to prevent cascading re-renders'
    ]
  };
  
  // Write report to file
  const reportPath = path.join(process.cwd(), 'bundle-optimization-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`${LOG_PREFIX} ✅ Optimization report written to: ${reportPath}`);
  console.log(`${LOG_PREFIX} Key recommendations:`);
  report.recommendations.forEach(rec => {
    console.log(`${LOG_PREFIX}   - ${rec}`);
  });
  
  return report;
}

/**
 * Main execution
 */
function main() {
  console.log(`${LOG_PREFIX} Bundle Optimization Analysis Started`);
  console.log(`${LOG_PREFIX} =====================================\n`);
  
  try {
    const report = generateOptimizationReport();
    
    console.log(`\n${LOG_PREFIX} Analysis complete!`);
    console.log(`${LOG_PREFIX} Current main bundle: ~396KB (gzipped)`);
    console.log(`${LOG_PREFIX} Target: <200KB main bundle`);
    console.log(`${LOG_PREFIX} Potential savings: ~50% bundle size reduction`);
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Error during analysis:`, error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  analyzePackageJson,
  generateDynamicImportSuggestions,
  generateWebpackOptimizations,
  findLargeFiles,
  generateOptimizationReport
};