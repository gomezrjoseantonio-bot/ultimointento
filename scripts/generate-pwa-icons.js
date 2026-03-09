/**
 * Generate PWA icons for ATLAS application
 * Creates 192px, 512px, and maskable icons using SVG
 */

const fs = require('fs');
const path = require('path');

// Icon configurations
const iconSizes = [192, 512];
const publicDir = path.join(__dirname, '..', 'public');

// SVG icon generator function
function generateSVG(size, isMaskable = false) {
  const bgColor = isMaskable ? '#1f2937' : '#3b82f6'; // Gray-800 for maskable, blue-500 for regular
  const padding = isMaskable ? size * 0.15 : size * 0.05; // More padding for maskable
  const fontSize = (size - padding * 2) * 0.6;
  const subtitleSize = fontSize * 0.15;
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${bgColor}"/>
  <text x="${size/2}" y="${size/2}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" 
        text-anchor="middle" dominant-baseline="central" fill="white">A</text>
  ${size >= 512 ? `<text x="${size/2}" y="${size * 0.75}" font-family="Arial, sans-serif" font-size="${subtitleSize}" 
        text-anchor="middle" dominant-baseline="central" fill="white">ATLAS</text>` : ''}
</svg>`;
}

// Generate icons
console.log('Generating PWA icons...');

try {
  // Standard icons
  iconSizes.forEach(size => {
    const svgContent = generateSVG(size, false);
    const filename = `icon-${size}x${size}.svg`;
    fs.writeFileSync(path.join(publicDir, filename), svgContent);
    console.log(`✓ Generated ${filename}`);
  });
  
  // Maskable icon (512x512)
  const maskableSvg = generateSVG(512, true);
  fs.writeFileSync(path.join(publicDir, 'icon-512x512-maskable.svg'), maskableSvg);
  console.log('✓ Generated icon-512x512-maskable.svg');
  
  console.log('\n🎉 All PWA icons generated successfully!');
  console.log('\nNote: SVG icons created. For production, consider converting to PNG format.');
  
} catch (error) {
  console.error('❌ Error generating icons:', error.message);
  process.exit(1);
}