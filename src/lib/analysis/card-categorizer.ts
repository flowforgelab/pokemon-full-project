import { Card, Supertype } from '@prisma/client';
import { 
  TRAINER_CATEGORIES, 
  ENERGY_ACCELERATION,
  ENERGY_TYPES,
  CARD_POWER_RATINGS
} from './pokemon-tcg-knowledge';

export interface CardClassification {
  // Primary classification
  category: 'pokemon' | 'trainer' | 'energy';
  subcategory: string;
  
  // Pokemon specific
  role?: 'main_attacker' | 'support_attacker' | 'ability_support' | 'wall' | 'starter';
  setupSpeed?: 'immediate' | 'fast' | 'moderate' | 'slow';
  prizeValue?: 1 | 2 | 3;
  
  // Trainer specific  
  trainerType?: 'draw' | 'search' | 'energy_accel' | 'disruption' | 'recovery' | 'stadium' | 'tool';
  powerLevel?: number; // 1-10 scale
  
  // Energy specific
  energyType?: string;
  isSpecial?: boolean;
  provides?: string[];
  
  // General
  isTechCard?: boolean;
  synergies?: string[];
  counters?: string[];
}

export class CardCategorizer {
  /**
   * Categorize a card based on its properties and text
   */
  categorizeCard(card: Card): CardClassification {
    switch (card.supertype) {
      case Supertype.POKEMON:
        return this.categorizePokemon(card);
      case Supertype.TRAINER:
        return this.categorizeTrainer(card);
      case Supertype.ENERGY:
        return this.categorizeEnergy(card);
      default:
        throw new Error(`Unknown supertype: ${card.supertype}`);
    }
  }
  
  /**
   * Categorize Pokemon cards
   */
  private categorizePokemon(card: Card): CardClassification {
    const cardText = JSON.stringify(card).toLowerCase();
    const attacks = (card.attacks as any[]) || [];
    const abilities = (card.abilities as any[]) || [];
    const hp = card.hp || 0;
    
    // Determine prize value
    let prizeValue: 1 | 2 | 3 = 1;
    if (card.name.includes('VSTAR') || card.name.includes('VMAX')) {
      prizeValue = 3;
    } else if (card.name.includes(' ex') || card.name.includes(' V') || card.name.includes(' GX')) {
      prizeValue = 2;
    }
    
    // Determine role
    let role: CardClassification['role'] = 'support_attacker';
    
    // Check for ability-based support
    if (abilities.length > 0) {
      const abilityText = abilities.map(a => a.text || '').join(' ').toLowerCase();
      if (abilityText.includes('draw') || abilityText.includes('search')) {
        role = 'ability_support';
      } else if (abilityText.includes('attach') && abilityText.includes('energy')) {
        role = 'ability_support';
      } else if (abilityText.includes('prevent') || abilityText.includes('reduce damage')) {
        role = 'wall';
      }
    }
    
    // Check attack power for main attacker status
    const maxDamage = Math.max(...attacks.map(a => {
      const damage = parseInt(a.damage) || 0;
      return damage;
    }));
    
    if (maxDamage >= 200 || (maxDamage >= 120 && prizeValue === 1)) {
      role = 'main_attacker';
    } else if (!card.evolvesFrom && hp <= 70 && abilities.length === 0) {
      role = 'starter';
    }
    
    // Determine setup speed
    let setupSpeed: CardClassification['setupSpeed'] = 'moderate';
    if (!card.evolvesFrom) {
      const minCost = Math.min(...attacks.map(a => a.cost?.length || 0));
      if (minCost <= 1) setupSpeed = 'immediate';
      else if (minCost === 2) setupSpeed = 'fast';
    } else if (card.stage === 1) {
      setupSpeed = 'fast';
    } else if (card.stage === 2) {
      setupSpeed = 'slow';
    }
    
    // Check for tech card status
    const isTechCard = this.checkIfTechCard(card);
    
    // Identify synergies
    const synergies = this.identifyPokemonSynergies(card);
    
    return {
      category: 'pokemon',
      subcategory: card.subtypes[0] || 'unknown',
      role,
      setupSpeed,
      prizeValue,
      isTechCard,
      synergies
    };
  }
  
  /**
   * Categorize Trainer cards
   */
  private categorizeTrainer(card: Card): CardClassification {
    const cardText = JSON.stringify(card).toLowerCase();
    const cardName = card.name;
    
    let trainerType: CardClassification['trainerType'] = 'recovery';
    let powerLevel = 5;
    
    // Check against known trainer categories
    for (const [category, cards] of Object.entries(TRAINER_CATEGORIES)) {
      const match = cards.find(c => c.name === cardName);
      if (match) {
        switch (category) {
          case 'DRAW_SUPPORTERS':
            trainerType = 'draw';
            break;
          case 'SEARCH_ITEMS':
            trainerType = 'search';
            break;
          case 'ENERGY_ACCELERATION':
            trainerType = 'energy_accel';
            break;
          case 'STADIUMS':
            trainerType = 'stadium';
            break;
          case 'DISRUPTION':
            trainerType = 'disruption';
            break;
        }
        powerLevel = match.power || 5;
        break;
      }
    }
    
    // If not in known categories, analyze text
    if (powerLevel === 5) {
      if (cardText.includes('draw')) {
        trainerType = 'draw';
        powerLevel = cardText.includes('draw 7') ? 9 : 6;
      } else if (cardText.includes('search your deck')) {
        trainerType = 'search';
        powerLevel = cardText.includes('any') ? 8 : 6;
      } else if (cardText.includes('attach') && cardText.includes('energy')) {
        trainerType = 'energy_accel';
        powerLevel = 7;
      } else if (cardText.includes('opponent') && (cardText.includes('discard') || cardText.includes('switch'))) {
        trainerType = 'disruption';
        powerLevel = 7;
      } else if (card.subtypes.includes('Tool')) {
        trainerType = 'tool';
      } else if (card.subtypes.includes('Stadium')) {
        trainerType = 'stadium';
      }
    }
    
    const synergies = this.identifyTrainerSynergies(card);
    
    return {
      category: 'trainer',
      subcategory: card.subtypes[0] || 'item',
      trainerType,
      powerLevel,
      synergies,
      isTechCard: this.checkIfTechCard(card)
    };
  }
  
  /**
   * Categorize Energy cards
   */
  private categorizeEnergy(card: Card): CardClassification {
    const cardName = card.name;
    const cardText = JSON.stringify(card).toLowerCase();
    
    // Check if special energy
    const isSpecial = !cardName.includes('Basic') || cardText.includes('special energy');
    
    // Determine energy types provided
    let provides: string[] = [];
    let energyType = ENERGY_TYPES.COLORLESS;
    
    // Match basic energy types
    for (const [key, value] of Object.entries(ENERGY_TYPES)) {
      if (cardName.includes(value)) {
        energyType = value;
        provides = [value];
        break;
      }
    }
    
    // Special energy analysis
    if (isSpecial) {
      if (cardName.includes('Double')) {
        provides = ['Colorless', 'Colorless'];
      } else if (cardName.includes('Twin')) {
        provides = ['Colorless', 'Colorless'];
      } else if (cardName.includes('Triple')) {
        provides = ['Colorless', 'Colorless', 'Colorless'];
      } else if (cardText.includes('provides every type')) {
        provides = Object.values(ENERGY_TYPES);
      } else if (cardText.includes('provides') && cardText.includes('type')) {
        // Parse specific types from text
        provides = ['Special'];
      }
    }
    
    return {
      category: 'energy',
      subcategory: isSpecial ? 'special' : 'basic',
      energyType,
      isSpecial,
      provides,
      synergies: this.identifyEnergySynergies(card)
    };
  }
  
  /**
   * Check if a card is commonly used as a tech card
   */
  private checkIfTechCard(card: Card): boolean {
    const techCardNames = [
      'Spiritomb', 'Radiant', 'Manaphy', 'Drapion V', 'Hawlucha',
      'Canceling Cologne', 'Lost City', 'Path to the Peak', 'Temple of Sinnoh',
      'Klefki', 'Mimikyu', 'Jirachi', 'Mew', 'Snorlax', 'Yveltal'
    ];
    
    return techCardNames.some(name => card.name.includes(name));
  }
  
  /**
   * Identify Pokemon synergies
   */
  private identifyPokemonSynergies(card: Card): string[] {
    const synergies: string[] = [];
    const cardText = JSON.stringify(card).toLowerCase();
    const abilities = (card.abilities as any[]) || [];
    
    // Type-based synergies
    if (card.types?.includes(ENERGY_TYPES.WATER)) {
      synergies.push('Baxcalibur', 'Irida', 'Superior Energy Retrieval');
    } else if (card.types?.includes(ENERGY_TYPES.PSYCHIC)) {
      synergies.push('Gardevoir ex', 'Fog Crystal', 'Bede');
    } else if (card.types?.includes(ENERGY_TYPES.FIRE)) {
      synergies.push('Charizard ex', 'Magma Basin', 'Entei V');
    }
    
    // Ability-based synergies
    if (abilities.some(a => a.text?.includes('Lost Zone'))) {
      synergies.push('Colress\'s Experiment', 'Lost City', 'Comfey');
    }
    
    // Evolution synergies
    if (card.evolvesFrom) {
      synergies.push('Rare Candy', 'Evolution Incense', 'Irida');
    }
    
    return synergies;
  }
  
  /**
   * Identify Trainer synergies
   */
  private identifyTrainerSynergies(card: Card): string[] {
    const synergies: string[] = [];
    const cardText = JSON.stringify(card).toLowerCase();
    
    if (cardText.includes('discard')) {
      synergies.push('Radiant Greninja', 'Bibarel', 'Superior Energy Retrieval');
    }
    
    if (cardText.includes('lost zone')) {
      synergies.push('Comfey', 'Sableye', 'Cramorant', 'Giratina VSTAR');
    }
    
    if (card.name.includes('Ball')) {
      synergies.push('Lumineon V', 'Peonia', 'Adventurer\'s Discovery');
    }
    
    return synergies;
  }
  
  /**
   * Identify Energy synergies
   */
  private identifyEnergySynergies(card: Card): string[] {
    const synergies: string[] = [];
    const cardName = card.name;
    
    if (cardName.includes('Double Turbo')) {
      synergies.push('Lugia VSTAR', 'Arceus VSTAR', 'Goodra VSTAR');
    } else if (cardName.includes('Twin Energy')) {
      synergies.push('Single Prize attackers', 'Radiant Pokemon');
    } else if (cardName.includes('Jet Energy')) {
      synergies.push('Pivot Pokemon', 'Lumineon V', 'Crobat V');
    }
    
    return synergies;
  }
  
  /**
   * Batch categorize multiple cards
   */
  categorizeCards(cards: Card[]): Map<string, CardClassification> {
    const categorized = new Map<string, CardClassification>();
    
    for (const card of cards) {
      try {
        categorized.set(card.id, this.categorizeCard(card));
      } catch (error) {
        console.error(`Failed to categorize card ${card.name}:`, error);
        // Provide a basic fallback
        categorized.set(card.id, {
          category: card.supertype.toLowerCase() as any,
          subcategory: 'unknown'
        });
      }
    }
    
    return categorized;
  }
  
  /**
   * Get draw support power rating
   */
  getDrawSupportRating(cards: Card[]): number {
    let totalPower = 0;
    let count = 0;
    
    for (const card of cards) {
      const classification = this.categorizeCard(card);
      if (classification.trainerType === 'draw' && classification.powerLevel) {
        totalPower += classification.powerLevel;
        count++;
      }
    }
    
    return count > 0 ? totalPower / count : 0;
  }
  
  /**
   * Count cards by role
   */
  countByRole(cards: Card[]): Record<string, number> {
    const counts: Record<string, number> = {
      main_attacker: 0,
      support_attacker: 0,
      ability_support: 0,
      wall: 0,
      starter: 0
    };
    
    for (const card of cards) {
      if (card.supertype === Supertype.POKEMON) {
        const classification = this.categorizeCard(card);
        if (classification.role) {
          counts[classification.role]++;
        }
      }
    }
    
    return counts;
  }
}