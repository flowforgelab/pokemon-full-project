'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Button from './Button';
import { useClerk, useUser } from '@clerk/nextjs';
import { 
  Home, 
  Layers, 
  Grid, 
  Package, 
  User, 
  Menu, 
  X,
  ChevronDown,
  Sparkles,
  Zap
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon?: React.ElementType;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Decks', href: '/decks', icon: Layers },
  { name: 'Cards', href: '/cards', icon: Grid },
  { name: 'Collection', href: '/collection', icon: Package },
];

export const PremiumNavigation: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const pathname = usePathname();
  const { user, isSignedIn } = useUser();
  const { signOut } = useClerk();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <motion.nav
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          isScrolled 
            ? 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg shadow-lg' 
            : 'bg-transparent'
        )}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <motion.div
                className="flex items-center space-x-3"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="absolute -inset-1 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg blur-md opacity-30" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  PokeDeck Pro
                </span>
              </motion.div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {navigation.map((item, index) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;

                return (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                  >
                    {item.children ? (
                      <div className="relative">
                        <button
                          onClick={() => setActiveDropdown(activeDropdown === item.name ? null : item.name)}
                          className={cn(
                            'px-3 py-2 rounded-lg font-medium transition-all duration-200',
                            'hover:bg-gray-100 dark:hover:bg-gray-800',
                            'flex items-center space-x-1',
                            isActive && 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30'
                          )}
                        >
                          {Icon && <Icon className="w-4 h-4" />}
                          <span>{item.name}</span>
                          <ChevronDown className={cn(
                            'w-4 h-4 transition-transform',
                            activeDropdown === item.name && 'rotate-180'
                          )} />
                        </button>
                        
                        <AnimatePresence>
                          {activeDropdown === item.name && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              transition={{ duration: 0.2 }}
                              className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                            >
                              {item.children.map((child) => (
                                <Link
                                  key={child.name}
                                  href={child.href}
                                  className="block px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                  onClick={() => setActiveDropdown(null)}
                                >
                                  {child.name}
                                </Link>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        className={cn(
                          'px-3 py-2 rounded-lg font-medium transition-all duration-200',
                          'hover:bg-gray-100 dark:hover:bg-gray-800',
                          'flex items-center space-x-2',
                          'relative group',
                          isActive && 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30'
                        )}
                      >
                        {Icon && <Icon className="w-4 h-4" />}
                        <span>{item.name}</span>
                        <span className={cn(
                          'absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 transform origin-left transition-transform duration-300',
                          isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                        )} />
                      </Link>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* User Menu / Auth Buttons */}
            <div className="hidden md:flex items-center space-x-4">
              {isSignedIn ? (
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center space-x-2"
                  >
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <span>Pro</span>
                  </Button>
                  
                  <div className="relative group">
                    <button className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {user.firstName?.[0] || user.username?.[0] || 'U'}
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                      <Link
                        href="/settings"
                        className="block px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        Settings
                      </Link>
                      <button
                        onClick={() => signOut()}
                        className="block w-full text-left px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => window.location.href = '/sign-in'}>
                    Sign In
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => window.location.href = '/sign-up'}>
                    Get Started
                  </Button>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 md:hidden"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
                <span className="text-lg font-semibold">Menu</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                        'hover:bg-gray-100 dark:hover:bg-gray-800',
                        isActive && 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400'
                      )}
                    >
                      {Icon && <Icon className="w-5 h-5" />}
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
              
              {isSignedIn ? (
                <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {user.firstName?.[0] || user.username?.[0] || 'U'}
                    </div>
                    <div>
                      <p className="font-medium">{user.firstName || user.username}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{user.primaryEmailAddress?.emailAddress}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    fullWidth
                    onClick={() => signOut()}
                  >
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="absolute bottom-0 left-0 right-0 p-6 space-y-3 border-t border-gray-200 dark:border-gray-800">
                  <Button
                    variant="outline"
                    fullWidth
                    onClick={() => window.location.href = '/sign-in'}
                  >
                    Sign In
                  </Button>
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={() => window.location.href = '/sign-up'}
                  >
                    Get Started
                  </Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};