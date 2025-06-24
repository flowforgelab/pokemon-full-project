'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'system',
  storageKey = 'pokedeck-theme',
}) => {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem(storageKey) as Theme;
    if (savedTheme) {
      setThemeState(savedTheme);
    }
  }, [storageKey]);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateTheme = () => {
      const resolved = theme === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : theme;
      setResolvedTheme(resolved);
      
      root.classList.remove('light', 'dark');
      root.classList.add(resolved);
      
      // Update meta theme-color
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute(
          'content',
          resolved === 'dark' ? '#1c1917' : '#ffffff'
        );
      }
    };

    updateTheme();

    if (theme === 'system') {
      mediaQuery.addEventListener('change', updateTheme);
      return () => mediaQuery.removeEventListener('change', updateTheme);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(storageKey, newTheme);
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Theme toggle button component
interface ThemeToggleProps {
  className?: string;
  variant?: 'icon' | 'menu';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  className, 
  variant = 'icon' 
}) => {
  // Try to use theme context, but provide fallback for static generation
  const themeContext = useContext(ThemeContext);
  
  // If no context (during static generation), render a placeholder
  if (!themeContext) {
    return (
      <button
        className={cn(
          'relative p-2 rounded-lg transition-colors',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          className
        )}
        aria-label="Toggle theme"
      >
        <Sun className="w-5 h-5 text-gray-700 dark:text-gray-300" />
      </button>
    );
  }
  
  const { theme, setTheme, resolvedTheme } = themeContext;

  if (variant === 'icon') {
    return (
      <button
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        className={cn(
          'relative p-2 rounded-lg transition-colors',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          className
        )}
        aria-label="Toggle theme"
      >
        <AnimatePresence mode="wait">
          {resolvedTheme === 'dark' ? (
            <motion.div
              key="moon"
              initial={{ rotate: -90, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              exit={{ rotate: 90, scale: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Moon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </motion.div>
          ) : (
            <motion.div
              key="sun"
              initial={{ rotate: 90, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              exit={{ rotate: -90, scale: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Sun className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    );
  }

  // Menu variant
  const themes: { value: Theme; label: string; icon: React.ElementType }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Sun },
  ];

  return (
    <div className={cn('space-y-1', className)}>
      {themes.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            'w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors',
            'hover:bg-gray-100 dark:hover:bg-gray-800',
            theme === value && 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400'
          )}
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
          {theme === value && (
            <motion.div
              layoutId="theme-indicator"
              className="ml-auto w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  );
};

// CSS variables injector for design tokens
export const ThemeStyleInjector: React.FC = () => {
  const themeContext = useContext(ThemeContext);
  
  // If no context, return null
  if (!themeContext) {
    return null;
  }
  
  const { resolvedTheme } = themeContext;
  
  useEffect(() => {
    // Import design tokens and generate CSS variables
    import('@/styles/design-tokens').then(({ generateCSSVariables }) => {
      const cssVars = generateCSSVariables(true); // Use HSL format for consistency
      const style = document.createElement('style');
      style.id = 'theme-variables';
      
      const cssText = Object.entries(cssVars)
        .map(([key, value]) => `${key}: ${value};`)
        .join('\n');
      
      style.textContent = `:root {\n${cssText}\n}`;
      
      // Remove existing style if any
      const existingStyle = document.getElementById('theme-variables');
      if (existingStyle) {
        existingStyle.remove();
      }
      
      document.head.appendChild(style);
    });
  }, [resolvedTheme]);
  
  return null;
};