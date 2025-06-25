'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CardHolographicProps {
  imageUrl: string;
  name: string;
  rarity?: string;
  className?: string;
  onClick?: () => void;
}

export const CardHolographic: React.FC<CardHolographicProps> = ({
  imageUrl,
  name,
  rarity,
  className,
  onClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    setMousePosition({ x, y });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setMousePosition({ x: 0.5, y: 0.5 });
  };

  const getHolographicGradient = () => {
    const x = mousePosition.x * 100;
    const y = mousePosition.y * 100;
    
    if (rarity === 'secret' || rarity === 'hyper') {
      return `radial-gradient(circle at ${x}% ${y}%, 
        rgba(255, 215, 0, 0.3),
        rgba(255, 105, 180, 0.3),
        rgba(0, 191, 255, 0.3),
        rgba(138, 43, 226, 0.3),
        transparent 60%)`;
    } else if (rarity === 'ultra' || rarity === 'holo') {
      return `radial-gradient(circle at ${x}% ${y}%, 
        rgba(100, 200, 255, 0.3),
        rgba(255, 100, 200, 0.3),
        transparent 50%)`;
    }
    return '';
  };

  return (
    <motion.div
      ref={cardRef}
      className={cn(
        'relative rounded-lg overflow-hidden cursor-pointer',
        'transition-all duration-300 ease-out',
        className
      )}
      whileHover={{ scale: 1.05, z: 50 }}
      whileTap={{ scale: 0.98 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        transformStyle: 'preserve-3d',
        transform: isHovered 
          ? `perspective(1000px) rotateY(${(mousePosition.x - 0.5) * 20}deg) rotateX(${(mousePosition.y - 0.5) * -20}deg)`
          : 'perspective(1000px) rotateY(0deg) rotateX(0deg)',
      }}
    >
      {/* Card Image */}
      <img
        src={imageUrl}
        alt={name}
        className="w-full h-full object-cover"
      />
      
      {/* Holographic Overlay */}
      {(rarity === 'holo' || rarity === 'ultra' || rarity === 'secret' || rarity === 'hyper') && (
        <div
          className="absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none"
          style={{
            background: getHolographicGradient(),
            opacity: isHovered ? 1 : 0,
            mixBlendMode: 'screen',
          }}
        />
      )}

      {/* Shimmer Effect */}
      {isHovered && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(105deg, 
              transparent 40%, 
              rgba(255, 255, 255, 0.2) 45%, 
              rgba(255, 255, 255, 0.1) 50%, 
              transparent 54%)`,
            transform: `translateX(${(mousePosition.x - 0.5) * 200}%)`,
          }}
        />
      )}

      {/* Glow Effect for Rare Cards */}
      {(rarity === 'ultra' || rarity === 'secret' || rarity === 'hyper') && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            boxShadow: isHovered
              ? '0 0 30px rgba(255, 215, 0, 0.6), 0 0 60px rgba(255, 215, 0, 0.3)'
              : '0 0 10px rgba(255, 215, 0, 0.2)',
          }}
          transition={{ duration: 0.3 }}
        />
      )}
    </motion.div>
  );
};