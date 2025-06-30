import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sizes = [16, 32, 72, 96, 128, 144, 152, 180, 192, 384, 512];

async function generateIcons() {
  const svgPath = path.join(process.cwd(), 'public/icons/icon.svg');
  const iconsDir = path.join(process.cwd(), 'public/icons');

  // Ensure the directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // Read the SVG file
  const svgBuffer = fs.readFileSync(svgPath);

  console.log('🎨 Generating icons...');

  for (const size of sizes) {
    try {
      // Generate standard icon
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
      
      console.log(`✅ Generated icon-${size}x${size}.png`);

      // Generate Apple icon for 180x180
      if (size === 180) {
        await sharp(svgBuffer)
          .resize(size, size)
          .png()
          .toFile(path.join(iconsDir, `apple-icon-${size}x${size}.png`));
        console.log(`✅ Generated apple-icon-${size}x${size}.png`);
      }
    } catch (error) {
      console.error(`❌ Error generating icon ${size}x${size}:`, error);
    }
  }

  // Generate a maskable icon with padding
  console.log('🎭 Generating maskable icons...');
  
  // Create a maskable version with safe zone padding (10% on each side)
  const maskableSvg = `
    <svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Background with safe zone -->
      <rect width="512" height="512" fill="#3b82f6"/>
      
      <!-- Scaled down content (80% size) centered -->
      <g transform="translate(51.2, 51.2) scale(0.8)">
        <!-- Pokeball shape -->
        <circle cx="256" cy="256" r="180" fill="white" opacity="0.9"/>
        <path d="M76 256C76 156.589 156.589 76 256 76C355.411 76 436 156.589 436 256H76Z" fill="#ef4444"/>
        <rect x="76" y="246" width="360" height="20" fill="#1c1917"/>
        <circle cx="256" cy="256" r="60" fill="white"/>
        <circle cx="256" cy="256" r="50" fill="#1c1917"/>
        <circle cx="256" cy="256" r="40" fill="white"/>
      </g>
    </svg>
  `;

  // Save maskable SVG
  fs.writeFileSync(path.join(iconsDir, 'icon-maskable.svg'), maskableSvg);

  console.log('✨ Icon generation complete!');
}

// Run the generation
generateIcons().catch(console.error);