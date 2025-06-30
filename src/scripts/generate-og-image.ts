import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateOGImage() {
  const width = 1200;
  const height = 630;
  const publicDir = path.join(process.cwd(), 'public');

  // Create SVG for Open Graph image
  const ogSvg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Gradient background -->
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#2563eb;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
        </linearGradient>
        
        <!-- Energy colors gradient -->
        <linearGradient id="energyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#ff6b6b;stop-opacity:1" />
          <stop offset="14%" style="stop-color:#4ecdc4;stop-opacity:1" />
          <stop offset="28%" style="stop-color:#51cf66;stop-opacity:1" />
          <stop offset="42%" style="stop-color:#ffd43b;stop-opacity:1" />
          <stop offset="56%" style="stop-color:#c77dff;stop-opacity:1" />
          <stop offset="70%" style="stop-color:#495057;stop-opacity:1" />
          <stop offset="84%" style="stop-color:#868e96;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#845ef7;stop-opacity:1" />
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="${width}" height="${height}" fill="url(#bgGradient)"/>
      
      <!-- Energy bar accent -->
      <rect x="0" y="${height - 10}" width="${width}" height="10" fill="url(#energyGradient)"/>
      
      <!-- Content container -->
      <rect x="60" y="60" width="${width - 120}" height="${height - 140}" rx="20" fill="white" opacity="0.1"/>
      
      <!-- Pokeball icon -->
      <g transform="translate(100, 150)">
        <circle cx="100" cy="100" r="80" fill="white" opacity="0.9"/>
        <path d="M20 100C20 55.8172 55.8172 20 100 20C144.183 20 180 55.8172 180 100H20Z" fill="#ef4444"/>
        <rect x="20" y="95" width="160" height="10" fill="#1c1917"/>
        <circle cx="100" cy="100" r="30" fill="white"/>
        <circle cx="100" cy="100" r="25" fill="#1c1917"/>
        <circle cx="100" cy="100" r="20" fill="white"/>
      </g>
      
      <!-- Text content -->
      <text x="350" y="200" font-family="Inter, system-ui, sans-serif" font-size="72" font-weight="800" fill="white">
        Pokemon TCG
      </text>
      <text x="350" y="280" font-family="Inter, system-ui, sans-serif" font-size="64" font-weight="700" fill="white">
        Deck Builder
      </text>
      
      <!-- Tagline -->
      <text x="350" y="360" font-family="Inter, system-ui, sans-serif" font-size="32" font-weight="400" fill="white" opacity="0.9">
        Build winning decks with AI-powered insights
      </text>
      
      <!-- Feature icons and text -->
      <g transform="translate(350, 420)">
        <!-- Card icon -->
        <rect x="0" y="0" width="40" height="56" rx="4" fill="white" opacity="0.8"/>
        <text x="60" y="35" font-family="Inter, system-ui, sans-serif" font-size="24" fill="white" opacity="0.9">
          13,600+ Cards
        </text>
        
        <!-- Analytics icon -->
        <rect x="250" y="10" width="40" height="36" rx="4" fill="white" opacity="0.8"/>
        <text x="310" y="35" font-family="Inter, system-ui, sans-serif" font-size="24" fill="white" opacity="0.9">
          Smart Analysis
        </text>
        
        <!-- Collection icon -->
        <circle cx="520" cy="28" r="20" fill="white" opacity="0.8"/>
        <text x="560" y="35" font-family="Inter, system-ui, sans-serif" font-size="24" fill="white" opacity="0.9">
          Track Collection
        </text>
      </g>
      
      <!-- URL -->
      <text x="${width - 60}" y="${height - 30}" text-anchor="end" font-family="Inter, system-ui, sans-serif" font-size="20" fill="white" opacity="0.7">
        pokemon-tcg-deck-builder.vercel.app
      </text>
    </svg>
  `;

  console.log('🎨 Generating Open Graph image...');

  try {
    // Generate the OG image
    await sharp(Buffer.from(ogSvg))
      .png()
      .toFile(path.join(publicDir, 'og-image.png'));
    
    console.log('✅ Generated og-image.png');

    // Also generate a square version for Twitter summary card
    const squareSvg = `
      <svg width="800" height="800" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
        <!-- Gradient background -->
        <defs>
          <linearGradient id="bgGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#2563eb;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
          </linearGradient>
        </defs>
        
        <!-- Background -->
        <rect width="800" height="800" fill="url(#bgGradient2)"/>
        
        <!-- Pokeball icon centered -->
        <g transform="translate(300, 200)">
          <circle cx="100" cy="100" r="100" fill="white" opacity="0.9"/>
          <path d="M0 100C0 44.7715 44.7715 0 100 0C155.228 0 200 44.7715 200 100H0Z" fill="#ef4444"/>
          <rect x="0" y="95" width="200" height="10" fill="#1c1917"/>
          <circle cx="100" cy="100" r="40" fill="white"/>
          <circle cx="100" cy="100" r="35" fill="#1c1917"/>
          <circle cx="100" cy="100" r="30" fill="white"/>
        </g>
        
        <!-- Text content centered -->
        <text x="400" y="480" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="64" font-weight="800" fill="white">
          Pokemon TCG
        </text>
        <text x="400" y="550" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="56" font-weight="700" fill="white">
          Deck Builder
        </text>
        
        <!-- Tagline -->
        <text x="400" y="620" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="400" fill="white" opacity="0.9">
          Build winning decks with AI
        </text>
      </svg>
    `;

    await sharp(Buffer.from(squareSvg))
      .png()
      .toFile(path.join(publicDir, 'twitter-image.png'));
    
    console.log('✅ Generated twitter-image.png');

    console.log('✨ Open Graph image generation complete!');
  } catch (error) {
    console.error('❌ Error generating images:', error);
  }
}

// Run the generation
generateOGImage().catch(console.error);