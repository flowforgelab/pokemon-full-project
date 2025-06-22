import { Card, DeckCard, Supertype } from '@prisma/client';
import type {
  SynergyAnalysis,
  TypeSynergy,
  AbilityCombo,
  TrainerSynergy,
  EnergySynergy,
  EvolutionSynergy,
  AttackCombo,
  SynergyNode,
  SynergyConnection,
} from './types';

export class SynergyAnalyzer {
  private cards: Map<string, Card & { quantity: number }>;
  private cardList: (Card & { quantity: number })[];
  private synergyGraph: Map<string, SynergyNode>;

  constructor(deckCards: (DeckCard & { card: Card })[]) {
    this.cards = new Map();
    this.cardList = [];
    this.synergyGraph = new Map();

    deckCards.forEach(dc => {
      const cardWithQuantity = {
        ...dc.card,
        quantity: dc.quantity,
      };
      this.cards.set(dc.card.id, cardWithQuantity);
      this.cardList.push(cardWithQuantity);
    });

    this.initializeSynergyGraph();
  }

  /**
   * Perform complete synergy analysis
   */
  analyze(): SynergyAnalysis {
    const typeSynergy = this.analyzeTypeSynergy();
    const abilityCombos = this.findAbilityCombos();
    const trainerSynergy = this.analyzeTrainerSynergy();
    const energySynergy = this.analyzeEnergySynergy();
    const evolutionSynergy = this.analyzeEvolutionSynergy();
    const attackCombos = this.findAttackCombos();

    // Build complete synergy graph
    this.buildSynergyConnections();

    // Calculate overall synergy score
    const overallSynergy = this.calculateOverallSynergy({
      typeSynergy,
      abilityCombos,
      trainerSynergy,
      energySynergy,
      evolutionSynergy,
      attackCombos,
    });

    return {
      typeSynergy,
      abilityCombos,
      trainerSynergy,
      energySynergy,
      evolutionSynergy,
      attackCombos,
      overallSynergy,
      synergyGraph: Array.from(this.synergyGraph.values()),
    };
  }

  /**
   * Initialize synergy graph nodes
   */
  private initializeSynergyGraph(): void {
    this.cardList.forEach(card => {
      this.synergyGraph.set(card.id, {
        cardId: card.id,
        cardName: card.name,
        connections: [],
      });
    });
  }

  /**
   * Analyze type synergy in the deck
   */
  private analyzeTypeSynergy(): TypeSynergy {
    const types = new Set<string>();
    const weaknesses = new Map<string, number>();
    const resistances = new Map<string, number>();

    // Collect all types, weaknesses, and resistances
    this.cardList.forEach(card => {
      if (card.supertype === Supertype.POKEMON) {
        // Add Pokemon types
        card.types?.forEach(type => types.add(type));

        // Track weaknesses
        const cardWeaknesses = card.weaknesses as any[];
        cardWeaknesses?.forEach(w => {
          weaknesses.set(w.type, (weaknesses.get(w.type) || 0) + card.quantity);
        });

        // Track resistances
        const cardResistances = card.resistances as any[];
        cardResistances?.forEach(r => {
          resistances.set(r.type, (resistances.get(r.type) || 0) + card.quantity);
        });
      }
    });

    // Calculate weakness coverage
    const uncoveredWeaknesses: string[] = [];
    weaknesses.forEach((count, type) => {
      // Check if we have Pokemon that resist this type
      if (!resistances.has(type) && count > 3) {
        uncoveredWeaknesses.push(type);
      }
    });

    const totalPokemon = this.cardList
      .filter(c => c.supertype === Supertype.POKEMON)
      .reduce((sum, c) => sum + c.quantity, 0);

    const weaknessCoverage = uncoveredWeaknesses.length === 0 ? 100 :
      (1 - uncoveredWeaknesses.length / weaknesses.size) * 100;

    const resistanceUtilization = resistances.size > 0 ?
      (Array.from(resistances.values()).reduce((a, b) => a + b, 0) / totalPokemon) * 100 : 0;

    const typeBalance = types.size >= 1 && types.size <= 3;

    return {
      weaknessCoverage,
      resistanceUtilization,
      typeBalance,
      vulnerabilities: uncoveredWeaknesses,
    };
  }

  /**
   * Find ability combinations
   */
  private findAbilityCombos(): AbilityCombo[] {
    const combos: AbilityCombo[] = [];
    const pokemonWithAbilities = this.cardList.filter(
      card => card.supertype === Supertype.POKEMON && card.abilities
    );

    // Check each pair of Pokemon for ability synergies
    for (let i = 0; i < pokemonWithAbilities.length; i++) {
      for (let j = i + 1; j < pokemonWithAbilities.length; j++) {
        const card1 = pokemonWithAbilities[i];
        const card2 = pokemonWithAbilities[j];
        
        const abilities1 = card1.abilities as any[];
        const abilities2 = card2.abilities as any[];

        // Check for synergistic abilities
        abilities1.forEach(ability1 => {
          abilities2.forEach(ability2 => {
            const synergy = this.checkAbilitySynergy(ability1, ability2, card1, card2);
            if (synergy.score > 0) {
              combos.push({
                pokemon: [card1.name, card2.name],
                abilities: [ability1.name, ability2.name],
                synergyScore: synergy.score,
                description: synergy.description,
              });

              // Add to synergy graph
              this.addSynergyConnection(card1.id, card2.id, synergy.score, 'positive', synergy.description);
            }
          });
        });
      }
    }

    // Sort by synergy score
    return combos.sort((a, b) => b.synergyScore - a.synergyScore);
  }

  /**
   * Analyze trainer card synergies
   */
  private analyzeTrainerSynergy(): TrainerSynergy[] {
    const synergies: TrainerSynergy[] = [];
    const trainers = this.cardList.filter(c => c.supertype === Supertype.TRAINER);

    // Look for trainer combinations that work well together
    for (let i = 0; i < trainers.length; i++) {
      for (let j = i + 1; j < trainers.length; j++) {
        const trainer1 = trainers[i];
        const trainer2 = trainers[j];

        const synergy = this.checkTrainerSynergy(trainer1, trainer2);
        if (synergy.score > 0) {
          synergies.push({
            cards: [trainer1.name, trainer2.name],
            effect: synergy.effect,
            synergyScore: synergy.score,
            frequency: (trainer1.quantity + trainer2.quantity) / 2,
          });

          // Add to synergy graph
          this.addSynergyConnection(trainer1.id, trainer2.id, synergy.score, 'positive', synergy.effect);
        }
      }
    }

    // Check for anti-synergies (cards that don't work well together)
    this.checkAntiSynergies(trainers);

    return synergies.sort((a, b) => b.synergyScore - a.synergyScore);
  }

  /**
   * Analyze energy synergy
   */
  private analyzeEnergySynergy(): EnergySynergy {
    const accelerationMethods: string[] = [];
    const energyRecycling: string[] = [];
    let efficiency = 70; // Base efficiency

    this.cardList.forEach(card => {
      const cardText = JSON.stringify(card).toLowerCase();

      // Check for energy acceleration
      if (cardText.includes('attach') && cardText.includes('energy') && 
          (cardText.includes('bench') || cardText.includes('additional'))) {
        accelerationMethods.push(card.name);
        efficiency += 5;
      }

      // Check for energy recycling
      if (cardText.includes('energy') && 
          (cardText.includes('discard pile') || cardText.includes('shuffle'))) {
        energyRecycling.push(card.name);
        efficiency += 3;
      }
    });

    // Check consistency based on energy count and acceleration
    const energyCount = this.cardList
      .filter(c => c.supertype === Supertype.ENERGY)
      .reduce((sum, c) => sum + c.quantity, 0);

    const consistency = this.calculateEnergyConsistency(
      energyCount,
      accelerationMethods.length,
      energyRecycling.length
    );

    return {
      accelerationMethods,
      energyRecycling,
      efficiency: Math.min(100, efficiency),
      consistency,
    };
  }

  /**
   * Analyze evolution synergy
   */
  private analyzeEvolutionSynergy(): EvolutionSynergy {
    const supportCards: string[] = [];
    let evolutionSpeed = 50; // Base speed
    let reliability = 50; // Base reliability

    // Find evolution support cards
    this.cardList.forEach(card => {
      const cardText = JSON.stringify(card).toLowerCase();

      if (card.supertype === Supertype.TRAINER) {
        // Evolution support trainers
        if (cardText.includes('evolution') || 
            cardText.includes('evolve') ||
            (cardText.includes('pokemon') && cardText.includes('deck'))) {
          supportCards.push(card.name);
          evolutionSpeed += 10;
          reliability += 8;
        }
      }
    });

    // Check for Pokemon with evolution acceleration abilities
    const evolutionPokemon = this.cardList.filter(
      c => c.supertype === Supertype.POKEMON && c.abilities
    );

    evolutionPokemon.forEach(pokemon => {
      const abilities = pokemon.abilities as any[];
      abilities.forEach(ability => {
        if (ability.text?.toLowerCase().includes('evolve')) {
          supportCards.push(`${pokemon.name} (${ability.name})`);
          evolutionSpeed += 15;
          reliability += 10;
        }
      });
    });

    return {
      supportCards,
      evolutionSpeed: Math.min(100, evolutionSpeed),
      reliability: Math.min(100, reliability),
    };
  }

  /**
   * Find attack combinations
   */
  private findAttackCombos(): AttackCombo[] {
    const combos: AttackCombo[] = [];
    const attackers = this.cardList.filter(
      c => c.supertype === Supertype.POKEMON && c.attacks
    );

    // Look for setup + payoff combinations
    for (let i = 0; i < attackers.length; i++) {
      for (let j = 0; j < attackers.length; j++) {
        if (i === j) continue;

        const setupPokemon = attackers[i];
        const attackerPokemon = attackers[j];

        const setupAttacks = setupPokemon.attacks as any[];
        const payoffAttacks = attackerPokemon.attacks as any[];

        setupAttacks.forEach(setupAttack => {
          payoffAttacks.forEach(payoffAttack => {
            const combo = this.checkAttackCombo(
              setupPokemon,
              setupAttack,
              attackerPokemon,
              payoffAttack
            );

            if (combo) {
              combos.push(combo);
              
              // Add to synergy graph
              this.addSynergyConnection(
                setupPokemon.id,
                attackerPokemon.id,
                combo.damage / 50, // Normalize damage to score
                'positive',
                combo.combo
              );
            }
          });
        });
      }
    }

    return combos.sort((a, b) => b.damage - a.damage);
  }

  /**
   * Build all synergy connections
   */
  private buildSynergyConnections(): void {
    // Additional connections beyond those already added
    
    // Energy type matching
    this.checkEnergyTypeMatching();
    
    // Evolution line connections
    this.checkEvolutionConnections();
    
    // Type coverage connections
    this.checkTypeCoverageConnections();
  }

  /**
   * Calculate overall synergy score
   */
  private calculateOverallSynergy(components: any): number {
    const weights = {
      type: 0.15,
      abilities: 0.25,
      trainers: 0.20,
      energy: 0.15,
      evolution: 0.10,
      attacks: 0.15,
    };

    let score = 0;

    // Type synergy score
    score += weights.type * (
      (components.typeSynergy.weaknessCoverage * 0.5) +
      (components.typeSynergy.resistanceUtilization * 0.3) +
      (components.typeSynergy.typeBalance ? 20 : 0)
    );

    // Ability combo score
    const abilityScore = components.abilityCombos.length > 0 ?
      Math.min(100, components.abilityCombos.reduce((sum: number, c: AbilityCombo) => 
        sum + c.synergyScore, 0) / components.abilityCombos.length * 20) : 50;
    score += weights.abilities * abilityScore;

    // Trainer synergy score
    const trainerScore = components.trainerSynergy.length > 0 ?
      Math.min(100, components.trainerSynergy.reduce((sum: number, t: TrainerSynergy) => 
        sum + t.synergyScore, 0) / components.trainerSynergy.length * 20) : 50;
    score += weights.trainers * trainerScore;

    // Energy synergy score
    score += weights.energy * ((components.energySynergy.efficiency + components.energySynergy.consistency) / 2);

    // Evolution synergy score
    score += weights.evolution * ((components.evolutionSynergy.evolutionSpeed + components.evolutionSynergy.reliability) / 2);

    // Attack combo score
    const attackScore = components.attackCombos.length > 0 ?
      Math.min(100, components.attackCombos.length * 20) : 50;
    score += weights.attacks * attackScore;

    return Math.round(score);
  }

  // Helper methods

  private checkAbilitySynergy(
    ability1: any,
    ability2: any,
    pokemon1: Card,
    pokemon2: Card
  ): { score: number; description: string } {
    const text1 = ability1.text?.toLowerCase() || '';
    const text2 = ability2.text?.toLowerCase() || '';

    // Energy acceleration + high damage
    if (text1.includes('attach') && text1.includes('energy') &&
        text2.includes('damage') && !text2.includes('less damage')) {
      return {
        score: 85,
        description: `${ability1.name} accelerates energy for ${ability2.name}`,
      };
    }

    // Draw power + hand size
    if ((text1.includes('draw') || text1.includes('look at')) &&
        (text2.includes('hand') || text2.includes('cards in hand'))) {
      return {
        score: 75,
        description: `${ability1.name} synergizes with ${ability2.name} for card advantage`,
      };
    }

    // Damage reduction + tanking
    if (text1.includes('less damage') && pokemon2.hp && parseInt(pokemon2.hp) > 150) {
      return {
        score: 70,
        description: `${ability1.name} helps ${pokemon2.name} tank hits`,
      };
    }

    // Bench protection + bench sitter
    if (text1.includes('bench') && text1.includes('damage') &&
        !pokemon2.retreatCost?.length) {
      return {
        score: 65,
        description: `${ability1.name} protects ${pokemon2.name} on bench`,
      };
    }

    return { score: 0, description: '' };
  }

  private checkTrainerSynergy(
    trainer1: Card,
    trainer2: Card
  ): { score: number; effect: string } {
    const text1 = JSON.stringify(trainer1).toLowerCase();
    const text2 = JSON.stringify(trainer2).toLowerCase();

    // Search + shuffle draw
    if (text1.includes('search') && text2.includes('shuffle') && text2.includes('draw')) {
      return {
        score: 80,
        effect: 'Search for key cards then shuffle draw',
      };
    }

    // Energy acceleration + energy switch
    if (text1.includes('energy') && text1.includes('attach') &&
        text2.includes('energy') && text2.includes('move')) {
      return {
        score: 75,
        effect: 'Accelerate energy then redistribute',
      };
    }

    // Discard + recovery
    if (text1.includes('discard') && !text1.includes('opponent') &&
        text2.includes('discard pile') && text2.includes('shuffle')) {
      return {
        score: 70,
        effect: 'Discard for effect then recover resources',
      };
    }

    // Stadium + stadium protection
    if (trainer1.subtypes.includes('Stadium') && 
        text2.includes('stadium') && text2.includes('discard')) {
      return {
        score: 60,
        effect: 'Stadium with protection from opponent stadiums',
      };
    }

    return { score: 0, effect: '' };
  }

  private checkAntiSynergies(trainers: (Card & { quantity: number })[]): void {
    // Check for conflicting stadiums
    const stadiums = trainers.filter(t => t.subtypes.includes('Stadium'));
    if (stadiums.length > 1) {
      for (let i = 0; i < stadiums.length; i++) {
        for (let j = i + 1; j < stadiums.length; j++) {
          this.addSynergyConnection(
            stadiums[i].id,
            stadiums[j].id,
            -50,
            'negative',
            'Conflicting stadiums'
          );
        }
      }
    }

    // Check for conflicting effects
    trainers.forEach(trainer1 => {
      trainers.forEach(trainer2 => {
        if (trainer1.id === trainer2.id) return;

        const text1 = JSON.stringify(trainer1).toLowerCase();
        const text2 = JSON.stringify(trainer2).toLowerCase();

        // Discard hand vs hand size matters
        if (text1.includes('discard') && text1.includes('hand') &&
            text2.includes('hand') && text2.includes('more')) {
          this.addSynergyConnection(
            trainer1.id,
            trainer2.id,
            -60,
            'negative',
            'Conflicting hand size strategies'
          );
        }
      });
    });
  }

  private calculateEnergyConsistency(
    energyCount: number,
    accelerationMethods: number,
    recyclingMethods: number
  ): number {
    let consistency = 50; // Base

    // Energy count factor
    if (energyCount >= 10 && energyCount <= 15) {
      consistency += 20;
    } else if (energyCount >= 8 && energyCount <= 18) {
      consistency += 10;
    }

    // Acceleration factor
    consistency += Math.min(20, accelerationMethods * 10);

    // Recycling factor
    consistency += Math.min(10, recyclingMethods * 5);

    return Math.min(100, consistency);
  }

  private checkAttackCombo(
    setupPokemon: Card,
    setupAttack: any,
    attackerPokemon: Card,
    payoffAttack: any
  ): AttackCombo | null {
    const setupText = setupAttack.text?.toLowerCase() || '';
    const payoffText = payoffAttack.text?.toLowerCase() || '';

    // Energy acceleration setup
    if (setupText.includes('attach') && setupText.includes('energy')) {
      const damage = parseInt(payoffAttack.damage) || 0;
      if (damage >= 120) {
        return {
          setupPokemon: setupPokemon.name,
          attackerPokemon: attackerPokemon.name,
          combo: `${setupAttack.name} → ${payoffAttack.name}`,
          damage,
          setupTurns: 1,
        };
      }
    }

    // Damage counter setup
    if (setupText.includes('damage counter') || setupText.includes('place')) {
      const damage = parseInt(payoffAttack.damage) || 0;
      const bonus = payoffText.includes('damage counter') ? 50 : 0;
      if (damage + bonus >= 100) {
        return {
          setupPokemon: setupPokemon.name,
          attackerPokemon: attackerPokemon.name,
          combo: `Place damage counters → ${payoffAttack.name}`,
          damage: damage + bonus,
          setupTurns: 2,
        };
      }
    }

    // Status condition setup
    if (setupText.includes('asleep') || setupText.includes('paralyzed')) {
      const damage = parseInt(payoffAttack.damage) || 0;
      const bonus = payoffText.includes('asleep') || payoffText.includes('status') ? 60 : 0;
      if (damage + bonus >= 90) {
        return {
          setupPokemon: setupPokemon.name,
          attackerPokemon: attackerPokemon.name,
          combo: `Status condition → ${payoffAttack.name}`,
          damage: damage + bonus,
          setupTurns: 1,
        };
      }
    }

    return null;
  }

  private checkEnergyTypeMatching(): void {
    const energyCards = this.cardList.filter(c => c.supertype === Supertype.ENERGY);
    const pokemonCards = this.cardList.filter(c => c.supertype === Supertype.POKEMON);

    energyCards.forEach(energy => {
      pokemonCards.forEach(pokemon => {
        if (pokemon.types?.some(type => energy.name.toLowerCase().includes(type.toLowerCase()))) {
          this.addSynergyConnection(
            energy.id,
            pokemon.id,
            50,
            'positive',
            'Type matching'
          );
        }
      });
    });
  }

  private checkEvolutionConnections(): void {
    this.cardList.forEach(card => {
      if (card.evolvesFrom) {
        const prevoCard = this.cardList.find(c => c.name === card.evolvesFrom);
        if (prevoCard) {
          this.addSynergyConnection(
            prevoCard.id,
            card.id,
            90,
            'positive',
            'Evolution line'
          );
        }
      }
    });
  }

  private checkTypeCoverageConnections(): void {
    const pokemonCards = this.cardList.filter(c => c.supertype === Supertype.POKEMON);

    pokemonCards.forEach(pokemon1 => {
      pokemonCards.forEach(pokemon2 => {
        if (pokemon1.id === pokemon2.id) return;

        // Check if pokemon2 covers pokemon1's weakness
        const weaknesses1 = pokemon1.weaknesses as any[] || [];
        weaknesses1.forEach(weakness => {
          if (pokemon2.resistances && 
              (pokemon2.resistances as any[]).some(r => r.type === weakness.type)) {
            this.addSynergyConnection(
              pokemon1.id,
              pokemon2.id,
              60,
              'positive',
              `${pokemon2.name} covers ${pokemon1.name}'s ${weakness.type} weakness`
            );
          }
        });
      });
    });
  }

  private addSynergyConnection(
    sourceId: string,
    targetId: string,
    strength: number,
    type: 'positive' | 'negative' | 'neutral',
    description: string
  ): void {
    const sourceNode = this.synergyGraph.get(sourceId);
    if (sourceNode) {
      // Check if connection already exists
      const existing = sourceNode.connections.find(c => c.targetId === targetId);
      if (!existing) {
        sourceNode.connections.push({
          targetId,
          strength,
          type,
          description,
        });
      }
    }
  }
}