import { useState, useRef, useEffect } from 'react';

export interface MultiSelectOption {
  value: string | number;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selectedValues: (string | number)[];
  onChange: (values: (string | number)[]) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

/**
 * Multi-select dropdown component with checkboxes.
 * Shows selected count and allows selecting/deselecting multiple options.
 */
export default function MultiSelect({
  options,
  selectedValues,
  onChange,
  placeholder = 'Select options...',
  label,
  className = '',
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleToggle = (value: string | number) => {
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onChange(newValues);
  };

  const handleSelectAll = () => {
    if (selectedValues.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(opt => opt.value));
    }
  };

  const selectedCount = selectedValues.length;
  const displayText = selectedCount === 0
    ? placeholder
    : selectedCount === 1
      ? `${selectedCount} selected`
      : `${selectedCount} selected`;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          selectedCount > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        <div className="flex items-center justify-between">
          <span>{displayText}</span>
          <svg
            className={`w-5 h-5 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleSelectAll}
              className="w-full text-left px-2 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              {selectedValues.length === options.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="p-1">
            {options.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <label
                  key={option.value}
                  className="flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggle(option.value)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

