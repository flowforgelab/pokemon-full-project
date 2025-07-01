'use client';

import React, { useEffect, useRef } from 'react';
import { SparklesIcon, LinkIcon } from '@heroicons/react/24/outline';
import type { SynergyAnalysis } from '@/lib/analysis/types';
import type { DeckCard, Card } from '@prisma/client';

interface SynergyNetworkProps {
  synergy: SynergyAnalysis;
  cards: (DeckCard & { card: Card })[];
}

export default function SynergyNetwork({ synergy, cards }: SynergyNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !synergy.synergyGraph) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 600;
    canvas.height = 400;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Simple visualization for now - will be enhanced later
    ctx.fillStyle = '#E5E7EB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#374151';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Synergy Network Visualization', canvas.width / 2, canvas.height / 2);
    ctx.font = '12px sans-serif';
    ctx.fillText('(Interactive graph coming soon)', canvas.width / 2, canvas.height / 2 + 20);
  }, [synergy]);

  return (
    <div className="space-y-6">
      {/* Synergy Overview */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Card Synergy Analysis
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              How well your cards work together
            </p>
          </div>
          <div className="text-center">
            <SparklesIcon className="h-12 w-12 text-purple-500 mx-auto mb-2" />
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {synergy.overallSynergy}%
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Synergy Score
            </p>
          </div>
        </div>
      </div>

      {/* Synergy Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Type Coverage</h4>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {synergy.typeSynergy.weaknessCoverage}%
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Weakness coverage
          </p>
          {synergy.typeSynergy.vulnerabilities.length > 0 && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              Vulnerable to: {synergy.typeSynergy.vulnerabilities.join(', ')}
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Energy Synergy</h4>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {synergy.energySynergy.efficiency}%
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Energy efficiency
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            {synergy.energySynergy.accelerationMethods.length} acceleration methods
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Evolution Support</h4>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {synergy.evolutionSynergy.reliability}%
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Evolution reliability
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            Speed: {synergy.evolutionSynergy.evolutionSpeed}/5
          </p>
        </div>
      </div>

      {/* Ability Combos */}
      {synergy.abilityCombos.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Ability Combinations
          </h4>
          <div className="space-y-3">
            {synergy.abilityCombos.slice(0, 5).map((combo, idx) => (
              <div key={idx} className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-purple-900 dark:text-purple-100">
                      {combo.pokemon.join(' + ')}
                    </p>
                    <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                      {combo.abilities.join(' + ')}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic">
                      {combo.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                      {combo.synergyScore}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">score</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attack Combos */}
      {synergy.attackCombos.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
            Attack Combinations
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {synergy.attackCombos.slice(0, 4).map((combo, idx) => (
              <div key={idx} className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-red-900 dark:text-red-100">
                    {combo.setupPokemon} → {combo.attackerPokemon}
                  </span>
                  <span className="text-lg font-bold text-red-600 dark:text-red-400">
                    {combo.damage}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {combo.combo}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Setup: {combo.setupTurns} turns
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trainer Synergies */}
      {synergy.trainerSynergy.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
            Trainer Card Synergies
          </h4>
          <div className="space-y-3">
            {synergy.trainerSynergy.slice(0, 5).map((trainer, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {trainer.cards.join(' + ')}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {trainer.effect}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {trainer.synergyScore}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {trainer.frequency}x/game
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Synergy Network Visualization (Placeholder) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
          Synergy Network Graph
        </h4>
        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 flex justify-center">
          <canvas ref={canvasRef} className="max-w-full" />
        </div>
      </div>
    </div>
  );
}