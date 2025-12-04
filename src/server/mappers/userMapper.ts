import type { User } from '../../shared/types';
import type { IUserDocument } from '../models/UserModel';

/**
 * Maps a MongoDB user document to a User DTO
 */
export function mapUserDocToDto(doc: IUserDocument): User {
  return {
    id: doc._id.toString(),
    email: doc.email,
    displayName: doc.displayName,
    createdAt: doc.createdAt.toISOString(),
    settings: doc.settings,
  };
}

/**
 * Maps multiple MongoDB user documents to User DTOs
 */
export function mapUserDocsToDtos(docs: IUserDocument[]): User[] {
  return docs.map(mapUserDocToDto);
}

