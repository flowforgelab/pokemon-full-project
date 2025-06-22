import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        pokemon: {
          // Type colors
          normal: '#A8A878',
          fighting: '#C03028',
          flying: '#A890F0',
          poison: '#A040A0',
          ground: '#E0C068',
          rock: '#B8A038',
          bug: '#A8B820',
          ghost: '#705898',
          steel: '#B8B8D0',
          fire: '#F08030',
          water: '#6890F0',
          grass: '#78C850',
          electric: '#F8D030',
          psychic: '#F85888',
          ice: '#98D8D8',
          dragon: '#7038F8',
          dark: '#705848',
          fairy: '#EE99AC',
          // Additional brand colors
          yellow: '#FFCB05',
          blue: '#3D7DCA',
          darkBlue: '#003A70',
          gold: '#B3A125',
          red: '#EE1515',
        },
        tcg: {
          common: '#1a1a1a',
          uncommon: '#2d5a2d',
          rare: '#1e3a8a',
          holo: '#581c87',
          ultra: '#dc2626',
          secret: '#eab308',
          promo: '#0891b2',
        },
      },
      fontFamily: {
        pokemon: ['var(--font-geist-sans)', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'card-holo':
          'linear-gradient(105deg, transparent 40%, rgba(255, 219, 112, 0.8) 45%, rgba(132, 50, 255, 0.6) 50%, transparent 54%)',
      },
      animation: {
        'card-shine': 'card-shine 0.5s ease-in-out',
        'card-hover': 'card-hover 0.3s ease-in-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'card-shine': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'card-hover': {
          '0%': { transform: 'translateY(0px) scale(1)' },
          '50%': { transform: 'translateY(-5px) scale(1.02)' },
          '100%': { transform: 'translateY(0px) scale(1)' },
        },
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'holo': '0 0 20px rgba(132, 50, 255, 0.4)',
      },
      gridTemplateColumns: {
        'card-grid': 'repeat(auto-fill, minmax(200px, 1fr))',
        'deck-grid': 'repeat(auto-fill, minmax(280px, 1fr))',
      },
    },
  },
  plugins: [],
};

export default config;