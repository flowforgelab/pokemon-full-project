'use client';

import React, { useEffect, useRef } from 'react';
import type { DeckScores } from '@/lib/analysis/types';

interface ScoreRadarProps {
  scores: DeckScores;
  size?: number;
}

export default function ScoreRadar({ scores, size = 300 }: ScoreRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (!scores) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <p className="text-gray-500 dark:text-gray-400">No score data available</p>
      </div>
    );
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = size;
    canvas.height = size;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Configuration
    const center = size / 2;
    const radius = size * 0.35;
    const metrics = [
      { label: 'Consistency', value: scores.consistency, color: '#3B82F6' },
      { label: 'Power', value: scores.power, color: '#EF4444' },
      { label: 'Speed', value: scores.speed, color: '#10B981' },
      { label: 'Versatility', value: scores.versatility, color: '#8B5CF6' },
      { label: 'Meta Relevance', value: scores.metaRelevance, color: '#F59E0B' },
      { label: 'Innovation', value: scores.innovation, color: '#EC4899' },
    ];
    const numMetrics = metrics.length;
    const angleStep = (Math.PI * 2) / numMetrics;

    // Draw background circles
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath();
      const r = (radius / 5) * i;
      for (let j = 0; j <= numMetrics; j++) {
        const angle = angleStep * j - Math.PI / 2;
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        if (j === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#E5E7EB';
    for (let i = 0; i < numMetrics; i++) {
      const angle = angleStep * i - Math.PI / 2;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    // Draw data polygon
    ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    metrics.forEach((metric, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const value = metric.value / 100; // Normalize to 0-1
      const x = center + radius * value * Math.cos(angle);
      const y = center + radius * value * Math.sin(angle);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw points
    metrics.forEach((metric, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const value = metric.value / 100;
      const x = center + radius * value * Math.cos(angle);
      const y = center + radius * value * Math.sin(angle);
      
      ctx.fillStyle = metric.color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw labels
    ctx.fillStyle = '#374151';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    metrics.forEach((metric, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const labelRadius = radius + 30;
      const x = center + labelRadius * Math.cos(angle);
      const y = center + labelRadius * Math.sin(angle);
      
      // Adjust text alignment based on position
      if (Math.abs(x - center) < 10) {
        ctx.textAlign = 'center';
      } else if (x > center) {
        ctx.textAlign = 'left';
      } else {
        ctx.textAlign = 'right';
      }
      
      if (y < center - 10) {
        ctx.textBaseline = 'bottom';
      } else if (y > center + 10) {
        ctx.textBaseline = 'top';
      } else {
        ctx.textBaseline = 'middle';
      }
      
      ctx.fillText(`${metric.label} (${metric.value})`, x, y);
    });

    // Draw center score
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(scores.overall.toString(), center, center);
    
    ctx.font = '12px sans-serif';
    ctx.fillText('Overall', center, center + 20);

  }, [scores, size]);

  return (
    <div className="flex flex-col items-center">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Performance Radar
      </h3>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
        <canvas ref={canvasRef} className="max-w-full" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-gray-600 dark:text-gray-400">Consistency</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-gray-600 dark:text-gray-400">Power</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-gray-600 dark:text-gray-400">Speed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
          <span className="text-gray-600 dark:text-gray-400">Versatility</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span className="text-gray-600 dark:text-gray-400">Meta Relevance</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-pink-500"></div>
          <span className="text-gray-600 dark:text-gray-400">Innovation</span>
        </div>
      </div>
    </div>
  );
}