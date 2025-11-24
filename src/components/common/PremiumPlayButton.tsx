import React, { useState } from 'react';

interface PremiumPlayButtonProps {
  isPlaying?: boolean;
  onClick: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Premium circular Play/Pause button with gradient, shadows, and micro-interactions
 */
export default function PremiumPlayButton({
  isPlaying = false,
  onClick,
  disabled = false,
  size = 'md',
  className = '',
}: PremiumPlayButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const handleMouseDown = () => {
    setIsPressed(true);
  };

  const handleMouseUp = () => {
    setIsPressed(false);
  };

  const handleMouseLeave = () => {
    setIsPressed(false);
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      className={`
        ${sizeClasses[size]}
        rounded-full
        flex items-center justify-center
        relative
        transition-all duration-200 ease-out
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        ${className}
        ${
          isPressed
            ? 'scale-95 shadow-md'
            : 'scale-100 hover:scale-105 hover:brightness-110'
        }
        ${
          isPlaying
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-2xl shadow-blue-500/50'
            : 'bg-gradient-to-br from-blue-400 to-blue-500 shadow-lg shadow-blue-500/30'
        }
      `}
      style={{
        boxShadow: isPlaying
          ? '0 10px 25px -5px rgba(59, 130, 246, 0.5), 0 4px 6px -2px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
          : '0 4px 14px 0 rgba(59, 130, 246, 0.4), 0 2px 4px 0 rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
      }}
      aria-label={isPlaying ? 'Pause' : 'Play'}
    >
      {/* Icon */}
      <div className={`${iconSizes[size]} text-white flex items-center justify-center`}>
        {isPlaying ? (
          // Pause icon
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-full h-full"
          >
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          // Play icon
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-full h-full"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </div>
    </button>
  );
}

