import { Card, DeckCard } from '@prisma/client';
import { CardCategorizer } from './card-categorizer';
import { 
  CARD_SYNERGIES, 
  ENERGY_ACCELERATION,
  META_ARCHETYPES,
  TRAINER_CATEGORIES 
} from './pokemon-tcg-knowledge';
import type { 
  SynergyAnalysis,
  TypeSynergy,
  AbilityCombo,
  TrainerSynergy,
  EnergySynergy,
  EvolutionSynergy,
  AttackCombo
} from './types';

export class EnhancedSynergyAnalyzer {
  private categorizer: CardCategorizer;
  private cards: (DeckCard & { card: Card })[];
  private categorizedCards: Map<string, any>;

  constructor(deckCards: (DeckCard & { card: Card })[]) {
    this.cards = deckCards;
    this.categorizer = new CardCategorizer();
    this.categorizedCards = this.categorizer.categorizeCards(
      deckCards.map(dc => dc.card)
    );
  }

  /**
   * Perform comprehensive synergy analysis with real Pokemon TCG knowledge
   */
  analyze(): SynergyAnalysis {
    return {
      typeSynergy: this.analyzeTypeSynergy(),
      abilityCombos: this.findAbilityCombos(),
      trainerSynergy: this.analyzeTrainerSynergy(),
      energySynergy: this.analyzeEnergySynergy(),
      evolutionSynergy: this.analyzeEvolutionSynergy(),
      attackCombos: this.findAttackCombos(),
      overallSynergy: this.calculateOverallSynergy(),
      synergyGraph: this.buildSynergyGraph()
    };
  }

  /**
   * Analyze type synergy and coverage
   */
  private analyzeTypeSynergy(): TypeSynergy {
    const pokemonCards = this.cards.filter(dc => dc.card.supertype === 'POKEMON');
    const types = new Set<string>();
    const weaknesses = new Map<string, number>();
    const resistances = new Map<string, number>();
    
    pokemonCards.forEach(dc => {
      // Track types
      if (dc.card.types) {
        dc.card.types.forEach(type => types.add(type));
      }
      
      // Track weaknesses
      if (dc.card.weaknesses) {
        (dc.card.weaknesses as any[]).forEach(w => {
          weaknesses.set(w.type, (weaknesses.get(w.type) || 0) + dc.quantity);
        });
      }
      
      // Track resistances
      if (dc.card.resistances) {
        (dc.card.resistances as any[]).forEach(r => {
          resistances.set(r.type, (resistances.get(r.type) || 0) + dc.quantity);
        });
      }
    });
    
    // Calculate weakness coverage
    const uniqueWeaknesses = Array.from(weaknesses.keys());
    const coveredWeaknesses = uniqueWeaknesses.filter(weakness => 
      Array.from(types).some(type => this.typeBeats(type, weakness))
    );
    
    const weaknessCoverage = uniqueWeaknesses.length > 0 ? 
      (coveredWeaknesses.length / uniqueWeaknesses.length) * 100 : 100;
    
    // Calculate resistance utilization
    const resistanceUtilization = resistances.size > 0 ? 50 : 0;
    
    return {
      weaknessCoverage,
      resistanceUtilization,
      typeBalance: types.size <= 2, // Focused decks are usually better
      vulnerabilities: uniqueWeaknesses
    };
  }

  /**
   * Find ability-based combos
   */
  private findAbilityCombos(): AbilityCombo[] {
    const combos: AbilityCombo[] = [];
    const cardsWithAbilities = this.cards.filter(dc => 
      dc.card.abilities && (dc.card.abilities as any[]).length > 0
    );
    
    // Bibarel + Discard outlets
    const bibarel = cardsWithAbilities.find(dc => dc.card.name.includes('Bibarel'));
    if (bibarel) {
      const discardOutlets = this.cards.filter(dc => 
        dc.card.name.includes('Ultra Ball') ||
        dc.card.name.includes('Quick Ball') ||
        dc.card.name.includes('Professor\'s Research')
      );
      
      if (discardOutlets.length > 0) {
        combos.push({
          primaryCard: 'Bibarel',
          supportCards: discardOutlets.map(dc => dc.card.name),
          comboType: 'draw_engine',
          effectiveness: Math.min(100, 60 + discardOutlets.length * 10)
        });
      }
    }
    
    // Radiant Greninja + Concealed Cards
    const radiantGreninja = cardsWithAbilities.find(dc => 
      dc.card.name === 'Radiant Greninja'
    );
    if (radiantGreninja) {
      const energyCount = this.cards
        .filter(dc => dc.card.supertype === 'ENERGY')
        .reduce((sum, dc) => sum + dc.quantity, 0);
      
      combos.push({
        primaryCard: 'Radiant Greninja',
        supportCards: ['Energy cards'],
        comboType: 'draw_engine',
        effectiveness: Math.min(100, 50 + energyCount * 2)
      });
    }
    
    // Gardevoir ex + Psychic Pokemon
    const gardevoir = cardsWithAbilities.find(dc => dc.card.name === 'Gardevoir ex');
    if (gardevoir) {
      const psychicAttackers = this.cards.filter(dc => 
        dc.card.types?.includes('Psychic') && 
        dc.card.attacks && (dc.card.attacks as any[]).length > 0
      );
      
      if (psychicAttackers.length > 0) {
        combos.push({
          primaryCard: 'Gardevoir ex',
          supportCards: psychicAttackers.map(dc => dc.card.name),
          comboType: 'energy_acceleration',
          effectiveness: Math.min(100, 70 + psychicAttackers.length * 5)
        });
      }
    }
    
    // Lost Zone engine
    const comfey = cardsWithAbilities.find(dc => dc.card.name === 'Comfey');
    const colress = this.cards.find(dc => dc.card.name === "Colress's Experiment");
    
    if (comfey && colress) {
      const lostZoneCards = this.cards.filter(dc => {
        const cardText = JSON.stringify(dc.card).toLowerCase();
        return cardText.includes('lost zone');
      });
      
      combos.push({
        primaryCard: 'Comfey',
        supportCards: ["Colress's Experiment", ...lostZoneCards.map(dc => dc.card.name)],
        comboType: 'engine',
        effectiveness: Math.min(100, 60 + lostZoneCards.length * 8)
      });
    }
    
    return combos;
  }

  /**
   * Analyze trainer card synergies
   */
  private analyzeTrainerSynergy(): TrainerSynergy[] {
    const synergies: TrainerSynergy[] = [];
    
    // Battle VIP Pass + Lumineon V
    const vipPass = this.cards.find(dc => dc.card.name === 'Battle VIP Pass');
    const lumineon = this.cards.find(dc => dc.card.name === 'Lumineon V');
    
    if (vipPass && lumineon) {
      synergies.push({
        cards: ['Battle VIP Pass', 'Lumineon V'],
        synergyType: 'consistency',
        description: 'Turn 1 setup guarantee',
        powerLevel: 10
      });
    }
    
    // Irida + Water Pokemon
    const irida = this.cards.find(dc => dc.card.name === 'Irida');
    if (irida) {
      const waterPokemon = this.cards.filter(dc => 
        dc.card.types?.includes('Water')
      );
      
      if (waterPokemon.length > 0) {
        synergies.push({
          cards: ['Irida', ...waterPokemon.slice(0, 3).map(dc => dc.card.name)],
          synergyType: 'search',
          description: 'Water Pokemon search engine',
          powerLevel: 8
        });
      }
    }
    
    // Professor's Research + Discard synergies
    const research = this.cards.find(dc => dc.card.name === "Professor's Research");
    if (research) {
      const discardBenefits = this.cards.filter(dc => {
        const cardText = JSON.stringify(dc.card).toLowerCase();
        return cardText.includes('from your discard') || 
               dc.card.name.includes('Energy Retrieval') ||
               dc.card.name.includes('Ordinary Rod');
      });
      
      if (discardBenefits.length > 0) {
        synergies.push({
          cards: ["Professor's Research", ...discardBenefits.map(dc => dc.card.name)],
          synergyType: 'resource_management',
          description: 'Discard for value',
          powerLevel: 7
        });
      }
    }
    
    // Lost City + Single Prize attackers
    const lostCity = this.cards.find(dc => dc.card.name === 'Lost City');
    if (lostCity) {
      const singlePrizers = this.cards.filter(dc => {
        const category = this.categorizedCards.get(dc.card.id);
        return category?.prizeValue === 1 && category?.role?.includes('attacker');
      });
      
      if (singlePrizers.length > 0) {
        synergies.push({
          cards: ['Lost City', 'Single Prize attackers'],
          synergyType: 'disruption',
          description: 'Deny opponent prize cards',
          powerLevel: 8
        });
      }
    }
    
    return synergies;
  }

  /**
   * Analyze energy synergies and acceleration
   */
  private analyzeEnergySynergy(): EnergySynergy {
    const energyCards = this.cards.filter(dc => dc.card.supertype === 'ENERGY');
    const energyTypes = new Set(energyCards.flatMap(dc => dc.card.types || []));
    
    // Find acceleration methods
    const accelerationMethods: string[] = [];
    const energyRecycling: string[] = [];
    
    // Check for type-specific acceleration
    energyTypes.forEach(type => {
      const typeAccel = ENERGY_ACCELERATION[type] || [];
      typeAccel.forEach(method => {
        if (this.cards.some(dc => dc.card.name === method)) {
          accelerationMethods.push(method);
        }
      });
    });
    
    // Check for general acceleration
    ENERGY_ACCELERATION.GENERAL.forEach(method => {
      if (this.cards.some(dc => dc.card.name === method)) {
        accelerationMethods.push(method);
      }
    });
    
    // Check for energy recycling
    const recyclingCards = [
      'Energy Retrieval', 'Ordinary Rod', 'Superior Energy Retrieval',
      'Energy Recycler', 'Klara', 'Training Court'
    ];
    
    recyclingCards.forEach(card => {
      if (this.cards.some(dc => dc.card.name.includes(card))) {
        energyRecycling.push(card);
      }
    });
    
    // Calculate efficiency
    const efficiency = Math.min(100, 50 + accelerationMethods.length * 15 + energyRecycling.length * 10);
    
    // Check for special energy synergies
    const specialEnergy = energyCards.filter(dc => {
      const category = this.categorizedCards.get(dc.card.id);
      return category?.isSpecial;
    });
    
    const consistency = specialEnergy.length > 6 ? 40 : 70 + energyRecycling.length * 5;
    
    return {
      accelerationMethods,
      energyRecycling,
      efficiency,
      consistency
    };
  }

  /**
   * Analyze evolution line synergies
   */
  private analyzeEvolutionSynergy(): EvolutionSynergy {
    const evolutionPokemon = this.cards.filter(dc => dc.card.evolvesFrom);
    const supportCards: string[] = [];
    
    // Check for Rare Candy
    const rareCandy = this.cards.find(dc => dc.card.name === 'Rare Candy');
    if (rareCandy && evolutionPokemon.some(dc => dc.card.stage === 2)) {
      supportCards.push('Rare Candy');
    }
    
    // Check for Evolution Incense
    if (this.cards.some(dc => dc.card.name === 'Evolution Incense')) {
      supportCards.push('Evolution Incense');
    }
    
    // Check for Irida (Water evolution support)
    const hasWaterEvolutions = evolutionPokemon.some(dc => 
      dc.card.types?.includes('Water')
    );
    if (hasWaterEvolutions && this.cards.some(dc => dc.card.name === 'Irida')) {
      supportCards.push('Irida');
    }
    
    // Calculate evolution speed
    let evolutionSpeed = 50;
    if (rareCandy) evolutionSpeed += 30;
    if (supportCards.length >= 2) evolutionSpeed += 20;
    
    // Calculate reliability
    const basicCount = this.cards
      .filter(dc => !dc.card.evolvesFrom)
      .reduce((sum, dc) => sum + dc.quantity, 0);
    
    const evolutionCount = evolutionPokemon.reduce((sum, dc) => sum + dc.quantity, 0);
    const ratio = basicCount > 0 ? evolutionCount / basicCount : 0;
    
    const reliability = Math.min(100, 50 + (ratio > 0.5 ? 30 : 0) + supportCards.length * 10);
    
    return {
      supportCards,
      evolutionSpeed: Math.min(100, evolutionSpeed),
      reliability
    };
  }

  /**
   * Find attack-based combos
   */
  private findAttackCombos(): AttackCombo[] {
    const combos: AttackCombo[] = [];
    
    // Look for spread damage + finisher combos
    const spreadAttackers = this.cards.filter(dc => {
      const attacks = (dc.card.attacks as any[]) || [];
      return attacks.some(a => 
        a.text?.toLowerCase().includes('damage to each') ||
        a.text?.toLowerCase().includes('damage to all')
      );
    });
    
    const finishers = this.cards.filter(dc => {
      const attacks = (dc.card.attacks as any[]) || [];
      return attacks.some(a => 
        a.text?.toLowerCase().includes('damage counter') ||
        parseInt(a.damage) >= 200
      );
    });
    
    if (spreadAttackers.length > 0 && finishers.length > 0) {
      combos.push({
        attackers: [
          spreadAttackers[0].card.name,
          finishers[0].card.name
        ],
        comboType: 'spread_and_sweep',
        damageOutput: '30 spread + 200+ finish',
        setupRequired: 2
      });
    }
    
    // Look for damage modifier combos
    const damageModifiers = this.cards.filter(dc => 
      dc.card.name.includes('Choice Belt') ||
      dc.card.name.includes('Defiance Band') ||
      dc.card.name === 'Radiant Hawlucha'
    );
    
    const attackers = this.cards.filter(dc => {
      const category = this.categorizedCards.get(dc.card.id);
      return category?.role === 'main_attacker';
    });
    
    if (damageModifiers.length > 0 && attackers.length > 0) {
      combos.push({
        attackers: [attackers[0].card.name],
        comboType: 'damage_boost',
        damageOutput: '+30 damage',
        setupRequired: 1
      });
    }
    
    return combos;
  }

  /**
   * Calculate overall synergy score
   */
  private calculateOverallSynergy(): number {
    let score = 40; // Base score
    
    // Check for complete engines
    const hasDrawEngine = this.cards.some(dc => 
      dc.card.name.includes('Bibarel') || 
      dc.card.name === 'Radiant Greninja'
    );
    if (hasDrawEngine) score += 15;
    
    // Check for energy acceleration
    const hasEnergyAccel = this.analyzeEnergySynergy().accelerationMethods.length > 0;
    if (hasEnergyAccel) score += 15;
    
    // Check for search consistency
    const searchCards = this.cards.filter(dc => {
      const category = this.categorizedCards.get(dc.card.id);
      return category?.trainerType === 'search';
    }).length;
    score += Math.min(20, searchCards * 2);
    
    // Check for known meta combos
    for (const [engineType, engineCombos] of Object.entries(CARD_SYNERGIES)) {
      const hasCombo = engineCombos.some(combo =>
        combo.every(cardName => 
          this.cards.some(dc => dc.card.name.includes(cardName))
        )
      );
      if (hasCombo) score += 10;
    }
    
    return Math.min(100, score);
  }

  /**
   * Build a synergy graph showing card relationships
   */
  private buildSynergyGraph(): any[] {
    const graph: any[] = [];
    
    // Add ability combos
    this.findAbilityCombos().forEach(combo => {
      graph.push({
        type: 'ability_combo',
        primary: combo.primaryCard,
        connected: combo.supportCards,
        strength: combo.effectiveness
      });
    });
    
    // Add trainer synergies
    this.analyzeTrainerSynergy().forEach(synergy => {
      if (synergy.cards.length >= 2) {
        graph.push({
          type: 'trainer_synergy',
          primary: synergy.cards[0],
          connected: synergy.cards.slice(1),
          strength: synergy.powerLevel * 10
        });
      }
    });
    
    // Add energy relationships
    const energySynergy = this.analyzeEnergySynergy();
    if (energySynergy.accelerationMethods.length > 0) {
      graph.push({
        type: 'energy_acceleration',
        primary: 'Energy System',
        connected: energySynergy.accelerationMethods,
        strength: energySynergy.efficiency
      });
    }
    
    return graph;
  }

  /**
   * Helper to check type advantages
   */
  private typeBeats(attackerType: string, defenderType: string): boolean {
    // Simplified type chart
    const typeAdvantages: Record<string, string[]> = {
      'Fire': ['Grass', 'Metal'],
      'Water': ['Fire', 'Ground', 'Rock'],
      'Grass': ['Water', 'Ground', 'Rock'],
      'Lightning': ['Water', 'Flying'],
      'Psychic': ['Fighting', 'Poison'],
      'Fighting': ['Darkness', 'Metal', 'Colorless'],
      'Darkness': ['Psychic', 'Ghost'],
      'Metal': ['Fairy', 'Ice'],
      'Dragon': ['Dragon']
    };
    
    return typeAdvantages[attackerType]?.includes(defenderType) || false;
  }
}