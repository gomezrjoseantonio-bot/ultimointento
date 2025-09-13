#!/usr/bin/env node

/**
 * Extract Critical CSS Tool
 * Identifies and extracts critical above-the-fold CSS to improve performance
 */

const fs = require('fs');
const path = require('path');

const LOG_PREFIX = '[CRITICAL-CSS]';

/**
 * Critical CSS selectors for above-the-fold content
 * These are the minimum required styles for initial render
 */
const CRITICAL_SELECTORS = [
  // Reset and base styles
  '*',
  'html',
  'body', 
  '#root',
  
  // Typography basics
  '.font-sans',
  '.text-base',
  '.text-sm',
  '.text-lg',
  '.text-xl',
  '.text-2xl',
  '.text-3xl',
  
  // Layout fundamentals
  '.flex',
  '.flex-col',
  '.flex-row',
  '.grid',
  '.block',
  '.inline',
  '.inline-block',
  '.hidden',
  '.relative',
  '.absolute',
  '.fixed',
  
  // Spacing that affects layout
  '.p-0', '.p-1', '.p-2', '.p-3', '.p-4', '.p-6', '.p-8',
  '.m-0', '.m-1', '.m-2', '.m-3', '.m-4', '.m-6', '.m-8',
  '.mx-auto',
  '.space-y-4', '.space-y-6', '.space-y-8',
  '.gap-2', '.gap-4', '.gap-6',
  
  // Colors for initial content
  '.bg-white',
  '.bg-gray-50',
  '.bg-gray-100',
  '.bg-primary-500',
  '.bg-atlas-blue',
  '.text-gray-900',
  '.text-gray-700',
  '.text-gray-600',
  '.text-white',
  '.text-atlas-blue',
  
  // Loading spinner and critical UI
  '.animate-spin',
  '.rounded-full',
  '.border-2',
  '.border-t-transparent',
  
  // Navigation and header
  '.w-full',
  '.h-16',
  '.h-8',
  '.h-12',
  '.min-h-screen',
  '.items-center',
  '.justify-center',
  '.justify-between',
  
  // Buttons for critical actions
  '.btn',
  '.btn-primary',
  '.rounded',
  '.rounded-lg',
  '.px-4',
  '.py-2',
  '.cursor-pointer',
  '.transition-colors',
  '.duration-200',
  
  // Critical component classes
  '.card',
  '.loading-spinner',
  '.main-layout',
  '.sidebar',
  '.header'
];

/**
 * Non-critical selectors that can be deferred
 * These styles are for below-the-fold content or interactive features
 */
const DEFER_SELECTORS = [
  // Charts and heavy UI components
  '.recharts-',
  '.chart-',
  '.canvas-',
  
  // Advanced animations
  '.animate-pulse',
  '.animate-bounce',
  '.transition-all',
  '.duration-300',
  '.duration-500',
  
  // Form styles (typically below fold)
  '.form-',
  'input[type',
  'select',
  'textarea',
  
  // Table styles
  '.table',
  '.thead',
  '.tbody',
  '.tr',
  '.td',
  '.th',
  
  // Modal and overlay styles  
  '.modal',
  '.overlay',
  '.backdrop',
  '.z-50',
  '.z-40',
  
  // Utility classes used in specific components
  '.transform',
  '.scale-',
  '.rotate-',
  '.translate-',
  '.opacity-',
  '.filter',
  '.blur-',
  '.drop-shadow-',
  
  // Advanced spacing
  '.space-y-12',
  '.space-x-',
  '.gap-8',
  '.gap-12',
  '.gap-16',
  
  // Print styles
  '@media print'
];

/**
 * Extract critical CSS from the main CSS file
 */
function extractCriticalCSS() {
  console.log(`${LOG_PREFIX} Starting critical CSS extraction...`);
  
  const buildCSSPath = path.join(__dirname, '../build/static/css');
  
  if (!fs.existsSync(buildCSSPath)) {
    console.error(`${LOG_PREFIX} Build CSS directory not found. Run 'npm run build' first.`);
    return;
  }
  
  // Find the main CSS file
  const cssFiles = fs.readdirSync(buildCSSPath).filter(file => file.startsWith('main.') && file.endsWith('.css'));
  
  if (cssFiles.length === 0) {
    console.error(`${LOG_PREFIX} No main CSS file found in build directory.`);
    return;
  }
  
  const mainCSSFile = cssFiles[0];
  const cssPath = path.join(buildCSSPath, mainCSSFile);
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  
  console.log(`${LOG_PREFIX} Processing ${mainCSSFile} (${Math.round(cssContent.length / 1024)}KB)`);
  
  // Split CSS into rules
  const cssRules = cssContent.split('}').map(rule => rule.trim() + '}').filter(rule => rule.length > 1);
  
  let criticalCSS = '';
  let deferredCSS = '';
  let criticalSize = 0;
  let deferredSize = 0;
  
  // Process each CSS rule
  cssRules.forEach(rule => {
    const isCritical = CRITICAL_SELECTORS.some(selector => {
      // Handle both class selectors and element selectors
      const normalizedSelector = selector.startsWith('.') ? selector : `.${selector}`;
      return rule.includes(normalizedSelector) || rule.includes(selector);
    });
    
    const isDeferred = DEFER_SELECTORS.some(selector => rule.includes(selector));
    
    if (isCritical && !isDeferred) {
      criticalCSS += rule + '\n';
      criticalSize += rule.length;
    } else {
      deferredCSS += rule + '\n';
      deferredSize += rule.length;
    }
  });
  
  // Add critical font loading styles
  const criticalFontCSS = `
/* Critical font loading */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

/* Critical base styles */
html, body {
  font-family: 'Inter', system-ui, sans-serif;
  margin: 0;
  padding: 0;
  min-height: 100vh;
  background-color: #F8F9FA;
  color: #303A4C;
}

#root {
  min-height: 100vh;
}

/* Critical loading state */
.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}
`;
  
  criticalCSS = criticalFontCSS + criticalCSS;
  criticalSize += criticalFontCSS.length;
  
  // Write critical CSS
  const criticalPath = path.join(__dirname, '../build/static/css/critical.css');
  fs.writeFileSync(criticalPath, criticalCSS);
  
  // Write deferred CSS
  const deferredPath = path.join(__dirname, '../build/static/css/deferred.css');
  fs.writeFileSync(deferredPath, deferredCSS);
  
  // Generate inline critical CSS for HTML
  const inlineCriticalPath = path.join(__dirname, '../build/critical-inline.css');
  fs.writeFileSync(inlineCriticalPath, criticalCSS);
  
  console.log(`${LOG_PREFIX} Critical CSS extraction completed:`);
  console.log(`${LOG_PREFIX}   Critical CSS: ${Math.round(criticalSize / 1024)}KB (${Math.round((criticalSize / cssContent.length) * 100)}%)`);
  console.log(`${LOG_PREFIX}   Deferred CSS: ${Math.round(deferredSize / 1024)}KB (${Math.round((deferredSize / cssContent.length) * 100)}%)`);
  console.log(`${LOG_PREFIX}   Total reduction: ${Math.round((deferredSize / 1024))}KB can be deferred`);
  
  return {
    critical: criticalPath,
    deferred: deferredPath,
    inline: inlineCriticalPath,
    savings: Math.round(deferredSize / 1024)
  };
}

/**
 * Generate optimized index.html with inline critical CSS
 */
function optimizeIndexHTML(paths) {
  console.log(`${LOG_PREFIX} Optimizing index.html with inline critical CSS...`);
  
  const indexPath = path.join(__dirname, '../build/index.html');
  
  if (!fs.existsSync(indexPath)) {
    console.error(`${LOG_PREFIX} Build index.html not found.`);
    return;
  }
  
  let indexContent = fs.readFileSync(indexPath, 'utf8');
  const criticalCSS = fs.readFileSync(paths.inline, 'utf8');
  
  // Remove the main CSS link and replace with inline critical CSS + deferred loading
  const cssLinkRegex = /<link[^>]*href="[^"]*main\.[^"]*\.css"[^>]*>/g;
  const cssFileName = indexContent.match(/href="[^"]*\/(main\.[^"]*\.css)"/)?.[1];
  
  if (cssFileName) {
    const optimizedHead = `
  <style>
    /* Critical CSS - Inline for immediate rendering */
    ${criticalCSS}
  </style>
  <link rel="preload" href="/static/css/deferred.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/static/css/deferred.css"></noscript>
  <script>
    /* Load deferred CSS asynchronously */
    (function() {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/static/css/deferred.css';
      link.media = 'print';
      link.onload = function() { this.media = 'all'; };
      document.head.appendChild(link);
    })();
  </script>`;
    
    indexContent = indexContent.replace(cssLinkRegex, optimizedHead);
    fs.writeFileSync(indexPath, indexContent);
    
    console.log(`${LOG_PREFIX} Index.html optimized with inline critical CSS`);
    console.log(`${LOG_PREFIX} Deferred CSS will load asynchronously`);
  }
}

/**
 * Main execution
 */
function main() {
  try {
    console.log(`${LOG_PREFIX} Starting CSS optimization process...`);
    
    const paths = extractCriticalCSS();
    
    if (paths) {
      optimizeIndexHTML(paths);
      
      console.log(`${LOG_PREFIX} ✅ CSS optimization completed successfully!`);
      console.log(`${LOG_PREFIX} Benefits:`);
      console.log(`${LOG_PREFIX}   - Faster first paint (critical CSS inline)`);
      console.log(`${LOG_PREFIX}   - Reduced render blocking (${paths.savings}KB deferred)`);
      console.log(`${LOG_PREFIX}   - Better performance scores`);
    }
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Error during CSS optimization:`, error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { extractCriticalCSS, optimizeIndexHTML };