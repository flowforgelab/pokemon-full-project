import { cn, formatCurrency, formatNumber, getInitials, isValidEmail, slugify } from '../index';

describe('Utility Functions', () => {
  describe('cn', () => {
    it('combines class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('handles conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
    });

    it('merges tailwind classes correctly', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    });
  });

  describe('formatCurrency', () => {
    it('formats USD currency', () => {
      expect(formatCurrency(10.5)).toBe('$10.50');
      expect(formatCurrency(1000)).toBe('$1,000.00');
    });

    it('handles other currencies', () => {
      expect(formatCurrency(10.5, 'EUR')).toBe('€10.50');
      expect(formatCurrency(10.5, 'GBP')).toBe('£10.50');
    });
  });

  describe('formatNumber', () => {
    it('formats numbers with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
    });

    it('handles decimals', () => {
      expect(formatNumber(1234.56)).toBe('1,234.56');
    });
  });

  describe('getInitials', () => {
    it('gets initials from name', () => {
      expect(getInitials('John Doe')).toBe('JD');
      expect(getInitials('Alice')).toBe('A');
      expect(getInitials('Bob Charlie Davis')).toBe('BD');
    });

    it('handles empty strings', () => {
      expect(getInitials('')).toBe('');
      expect(getInitials('   ')).toBe('');
    });
  });

  describe('isValidEmail', () => {
    it('validates correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
    });

    it('rejects invalid emails', () => {
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });
  });

  describe('slugify', () => {
    it('converts text to slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('This is a TEST')).toBe('this-is-a-test');
    });

    it('handles special characters', () => {
      expect(slugify('Hello & World!')).toBe('hello-world');
      expect(slugify('Test@#$%')).toBe('test');
    });

    it('handles multiple spaces', () => {
      expect(slugify('Too   many    spaces')).toBe('too-many-spaces');
    });
  });
});