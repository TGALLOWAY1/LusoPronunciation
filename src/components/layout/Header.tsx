interface HeaderProps {
  currentSection?: string;
}

export default function Header({ currentSection }: HeaderProps) {
  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-primary-600 dark:text-primary-400">
            🇧🇷 LusoPronounce
          </h1>
        </div>
        {currentSection && (
          <div className="text-base sm:text-lg font-medium text-gray-700 dark:text-gray-300">
            {currentSection}
          </div>
        )}
      </div>
    </header>
  );
}

