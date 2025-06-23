// Design tokens for the Pokemon TCG deck building application
// This file contains all design system variables for consistent styling

export const designTokens = {
  colors: {
    // Primary brand colors inspired by Pokemon energy types
    primary: {
      50: '#eff6ff',   // Lightest blue (water energy inspired)
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',  // Main brand blue
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',  // Darkest blue
      950: '#172554',
    },
    
    // Secondary accent colors (electric energy inspired)
    secondary: {
      50: '#fefce8',
      100: '#fef9c3',
      200: '#fef08a',
      300: '#fde047',
      400: '#facc15',
      500: '#eab308',  // Main accent yellow
      600: '#ca8a04',
      700: '#a16207',
      800: '#854d0e',
      900: '#713f12',
      950: '#422006',
    },
    
    // Energy type colors for Pokemon cards
    energy: {
      fire: '#ff6b6b',
      water: '#4ecdc4',
      grass: '#51cf66',
      electric: '#ffd43b',
      psychic: '#c77dff',
      fighting: '#ff8787',
      darkness: '#495057',
      metal: '#868e96',
      dragon: '#845ef7',
      fairy: '#ff6ec7',
      colorless: '#e9ecef',
    },
    
    // Premium gradients for hero sections and cards
    gradients: {
      heroBackground: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      cardPremium: 'linear-gradient(145deg, #f0f4f8 0%, #e2e8f0 100%)',
      holographic: 'linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #feca57)',
      darkMode: 'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)',
      sunrise: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)',
      ocean: 'linear-gradient(135deg, #4ecdc4 0%, #45b7d1 100%)',
      forest: 'linear-gradient(135deg, #51cf66 0%, #10b981 100%)',
      cosmic: 'linear-gradient(135deg, #c77dff 0%, #845ef7 100%)',
      premium: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #e66465 100%)',
    },
    
    // Semantic colors
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    
    // Neutral grays with warm undertones
    gray: {
      50: '#fafaf9',
      100: '#f5f5f4',
      200: '#e7e5e4',
      300: '#d6d3d1',
      400: '#a8a29e',
      500: '#78716c',
      600: '#57534e',
      700: '#44403c',
      800: '#292524',
      900: '#1c1917',
      950: '#0c0a09',
    },
  },
  
  // Premium typography system
  typography: {
    fontFamily: {
      display: ['Inter var', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
      body: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'monospace'],
    },
    
    fontSize: {
      xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.025em' }],
      sm: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.025em' }],
      base: ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
      lg: ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.025em' }],
      xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.025em' }],
      '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.025em' }],
      '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.05em' }],
      '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.05em' }],
      '5xl': ['3rem', { lineHeight: '1', letterSpacing: '-0.075em' }],
      '6xl': ['3.75rem', { lineHeight: '1', letterSpacing: '-0.075em' }],
      '7xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.075em' }],
      '8xl': ['6rem', { lineHeight: '1', letterSpacing: '-0.075em' }],
      '9xl': ['8rem', { lineHeight: '1', letterSpacing: '-0.075em' }],
    },
    
    fontWeight: {
      thin: '100',
      extralight: '200',
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
    },
  },
  
  // Sophisticated spacing system
  spacing: {
    px: '1px',
    0: '0px',
    0.5: '0.125rem',
    1: '0.25rem',
    1.5: '0.375rem',
    2: '0.5rem',
    2.5: '0.625rem',
    3: '0.75rem',
    3.5: '0.875rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    7: '1.75rem',
    8: '2rem',
    9: '2.25rem',
    10: '2.5rem',
    11: '2.75rem',
    12: '3rem',
    14: '3.5rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    28: '7rem',
    32: '8rem',
    36: '9rem',
    40: '10rem',
    44: '11rem',
    48: '12rem',
    52: '13rem',
    56: '14rem',
    60: '15rem',
    64: '16rem',
    72: '18rem',
    80: '20rem',
    96: '24rem',
  },
  
  // Premium shadows and depth
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    none: '0 0 #0000',
    
    // Special premium shadows
    glow: '0 0 20px rgb(59 130 246 / 0.3)',
    card: '0 4px 20px rgb(0 0 0 / 0.08), 0 1px 3px rgb(0 0 0 / 0.05)',
    floating: '0 12px 28px 0 rgb(0 0 0 / 0.2), 0 2px 4px 0 rgb(0 0 0 / 0.1)',
    holographic: '0 8px 32px rgb(59 130 246 / 0.3), 0 1px 2px rgb(0 0 0 / 0.05)',
    premium: '0 10px 40px rgb(0 0 0 / 0.15), 0 2px 10px rgb(0 0 0 / 0.1)',
  },
  
  // Border radius system
  borderRadius: {
    none: '0px',
    sm: '0.125rem',
    base: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    '4xl': '2rem',
    full: '9999px',
  },
  
  // Animation and transitions
  animation: {
    duration: {
      instant: '0ms',
      fast: '150ms',
      normal: '250ms',
      slow: '350ms',
      slower: '500ms',
      slowest: '750ms',
    },
    
    easing: {
      ease: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
  
  // Responsive breakpoints
  breakpoints: {
    xs: '475px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  
  // Z-index scale
  zIndex: {
    auto: 'auto',
    0: '0',
    10: '10',
    20: '20',
    30: '30',
    40: '40',
    50: '50',
    60: '60',
    70: '70',
    80: '80',
    90: '90',
    100: '100',
    dropdown: '1000',
    sticky: '1020',
    fixed: '1030',
    modalBackdrop: '1040',
    modal: '1050',
    popover: '1060',
    tooltip: '1070',
    notification: '1080',
    max: '9999',
  },
};

// CSS custom properties generator
export const generateCSSVariables = () => {
  const cssVars: Record<string, string> = {};
  
  // Colors
  Object.entries(designTokens.colors).forEach(([colorKey, colorValue]) => {
    if (typeof colorValue === 'string') {
      cssVars[`--color-${colorKey}`] = colorValue;
    } else if (typeof colorValue === 'object') {
      Object.entries(colorValue).forEach(([shade, value]) => {
        cssVars[`--color-${colorKey}-${shade}`] = value;
      });
    }
  });
  
  // Spacing
  Object.entries(designTokens.spacing).forEach(([key, value]) => {
    cssVars[`--spacing-${key}`] = value;
  });
  
  // Shadows
  Object.entries(designTokens.shadows).forEach(([key, value]) => {
    cssVars[`--shadow-${key}`] = value;
  });
  
  // Border radius
  Object.entries(designTokens.borderRadius).forEach(([key, value]) => {
    cssVars[`--radius-${key}`] = value;
  });
  
  // Animation
  Object.entries(designTokens.animation.duration).forEach(([key, value]) => {
    cssVars[`--duration-${key}`] = value;
  });
  
  return cssVars;
};

// Type exports for TypeScript
export type Colors = typeof designTokens.colors;
export type Typography = typeof designTokens.typography;
export type Spacing = typeof designTokens.spacing;
export type Shadows = typeof designTokens.shadows;
export type BorderRadius = typeof designTokens.borderRadius;
export type Animation = typeof designTokens.animation;
export type Breakpoints = typeof designTokens.breakpoints;
export type ZIndex = typeof designTokens.zIndex;