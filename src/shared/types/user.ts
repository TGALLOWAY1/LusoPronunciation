/**
 * Shared User type definitions
 * Used by both frontend and backend
 */

export interface User {
  id: string;
  email: string;
  displayName?: string;
  createdAt: string; // ISO timestamp
  settings?: UserSettings;
}

export interface UserSettings {
  language?: string;
  theme?: 'light' | 'dark' | 'auto';
  notifications?: boolean;
  // Add other user preferences as needed
}

