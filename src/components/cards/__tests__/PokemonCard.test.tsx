import React from 'react';
import { render, screen, fireEvent } from '@/test-utils';
import PokemonCard from '../PokemonCard';
import { mockCard } from '@/test-utils/mock-data';

describe('PokemonCard Component', () => {
  const defaultProps = {
    card: mockCard,
    layout: 'grid' as const,
    viewMode: 'compact' as const,
    onClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders card name', () => {
    render(<PokemonCard {...defaultProps} />);
    
    expect(screen.getByText('Alakazam')).toBeInTheDocument();
  });

  it('renders card image', () => {
    render(<PokemonCard {...defaultProps} />);
    
    const image = screen.getByAltText('Alakazam');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', mockCard.imageUrlLarge);
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<PokemonCard {...defaultProps} onClick={handleClick} />);
    
    const card = screen.getByAltText('Alakazam').closest('div.cursor-pointer');
    fireEvent.click(card!);
    expect(handleClick).toHaveBeenCalledWith(mockCard);
  });

  it('renders in different layouts', () => {
    const { rerender } = render(<PokemonCard {...defaultProps} layout="grid" />);
    let container = screen.getByAltText('Alakazam').closest('div');
    expect(container).toHaveClass('cursor-pointer');

    rerender(<PokemonCard {...defaultProps} layout="list" />);
    container = screen.getByAltText('Alakazam').closest('div');
    expect(container?.parentElement).toHaveClass('flex');
  });

  it('shows selected state', () => {
    render(<PokemonCard {...defaultProps} isSelected />);
    
    const container = screen.getByAltText('Alakazam').closest('div');
    expect(container).toHaveClass('ring-2');
  });

  it('renders correctly without optional props', () => {
    render(
      <PokemonCard
        card={mockCard}
        layout="grid"
        viewMode="compact"
      />
    );
    
    expect(screen.getByText('Alakazam')).toBeInTheDocument();
  });
});