import React from 'react';
import { render, screen, fireEvent } from '@/test-utils';
import Button from '../Button';

describe('Button Component', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('applies variant classes correctly', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-gradient-to-r', 'from-blue-600');

    rerender(<Button variant="secondary">Secondary</Button>);
    const secondaryButton = screen.getByRole('button');
    expect(secondaryButton).toHaveClass('bg-gray-200');

    rerender(<Button variant="destructive">Danger</Button>);
    const dangerButton = screen.getByRole('button');
    expect(dangerButton).toHaveClass('bg-red-600');
  });

  it('applies size classes correctly', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    const smallButton = screen.getByRole('button');
    expect(smallButton).toHaveClass('px-3', 'py-1.5', 'text-sm');

    rerender(<Button size="md">Medium</Button>);
    const mediumButton = screen.getByRole('button');
    expect(mediumButton).toHaveClass('px-4', 'py-2');

    rerender(<Button size="lg">Large</Button>);
    const largeButton = screen.getByRole('button');
    expect(largeButton).toHaveClass('px-6', 'py-3', 'text-lg');
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('can be disabled', () => {
    const handleClick = jest.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');

    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('shows loading state', () => {
    render(<Button isLoading>Loading</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    // Loading spinner is shown instead of text
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('renders with custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('renders with left icon', () => {
    const Icon = () => <svg data-testid="icon" />;
    render(<Button leftIcon={<Icon />}>With Icon</Button>);
    
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('With Icon')).toBeInTheDocument();
  });

  it('applies fullWidth class when prop is true', () => {
    render(<Button fullWidth>Full Width</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('w-full');
  });
});