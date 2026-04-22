import { useState } from 'react';

interface PremiumRecordButtonProps {
  isRecording: boolean;
  onClick: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Premium circular Record button with pulsing animation when active
 */
export default function PremiumRecordButton({
  isRecording,
  onClick,
  disabled = false,
  size = 'md',
  className = '',
}: PremiumRecordButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
  };

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-9 h-9',
  };

  const pulseRingSizes = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
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
    <div className={`relative inline-block ${className}`}>
      {/* Pulsing rings when recording */}
      {isRecording && (
        <>
          <div
            className={`
              ${pulseRingSizes[size]}
              absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
              rounded-full
              bg-primary-500/30
              animate-pulse-ring
            `}
          />
          <div
            className={`
              ${pulseRingSizes[size]}
              absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
              rounded-full
              bg-primary-500/20
              animate-pulse-ring
            `}
            style={{
              animationDelay: '0.5s',
            }}
          />
          <div
            className={`
              ${pulseRingSizes[size]}
              absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
              rounded-full
              bg-primary-500/10
              animate-pulse-ring
            `}
            style={{
              animationDelay: '1s',
            }}
          />
        </>
      )}

      {/* Button */}
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
          relative z-10
          transition-all duration-200 ease-out
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
          ${
            isPressed
              ? 'scale-95 shadow-md'
              : 'scale-100 hover:scale-105 hover:brightness-110'
          }
          ${
            isRecording
              ? 'bg-gradient-to-br from-primary-600 to-primary-700 shadow-2xl shadow-primary-500/50'
              : 'bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/30'
          }
        `}
        style={{
          boxShadow: isRecording
            ? '0 10px 25px -5px rgba(45, 134, 89, 0.5), 0 4px 6px -2px rgba(45, 134, 89, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
            : '0 4px 14px 0 rgba(45, 134, 89, 0.4), 0 2px 4px 0 rgba(45, 134, 89, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
        }}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {/* Microphone icon */}
        <div className={`${iconSizes[size]} text-white flex items-center justify-center`}>
          {isRecording ? (
            // Stop icon (square)
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-full h-full"
            >
              <path d="M6 6h12v12H6z" />
            </svg>
          ) : (
            // Microphone icon
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-full h-full"
            >
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          )}
        </div>
      </button>
    </div>
  );
}
