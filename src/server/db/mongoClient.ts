import mongoose from 'mongoose';

/**
 * MongoDB connection status
 */
export interface MongoStatus {
  connected: boolean;
  readyState: number;
  host?: string;
  name?: string;
}

/**
 * Singleton MongoDB connection manager
 * 
 * Usage:
 *   import { connectMongo, getMongoStatus } from './db/mongoClient';
 *   
 *   // On app startup
 *   await connectMongo();
 *   
 *   // Check status
 *   const status = await getMongoStatus();
 */
class MongoClient {
  private connection: typeof mongoose | null = null;
  private isConnecting = false;

  /**
   * Connects to MongoDB using the connection string from MONGODB_URI environment variable
   * 
   * @throws Error if MONGODB_URI is not set or connection fails
   */
  async connect(): Promise<void> {
    if (this.connection && this.connection.connection.readyState === 1) {
      console.log('[MongoDB] Already connected');
      return;
    }

    if (this.isConnecting) {
      console.log('[MongoDB] Connection already in progress, waiting...');
      // Wait for existing connection attempt
      while (this.isConnecting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.connection && this.connection.connection.readyState === 1) {
        return;
      }
    }

    const uri = process.env.MONGODB_URI;
    if (!uri || typeof uri !== 'string' || uri.trim() === '') {
      throw new Error(
        'Missing required environment variable: MONGODB_URI\n' +
        'Please set MONGODB_URI in your server environment.\n' +
        'Example: mongodb://localhost:27017/lusopronunciation'
      );
    }

    this.isConnecting = true;

    const maxRetries = 3;
    const redactedUri = uri.replace(/:([^@/]+)@/, ':****@');
    console.log(`[MongoDB] Connecting to ${redactedUri}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[MongoDB] Connection attempt ${attempt}/${maxRetries}...`);
        this.connection = await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 30000,
          connectTimeoutMS: 30000,
          socketTimeoutMS: 45000,
        });

        const db = this.connection.connection;
        console.log(`[MongoDB] Successfully connected to ${db.host}/${db.name}`);
        this.isConnecting = false;
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[MongoDB] Attempt ${attempt}/${maxRetries} failed:`, errorMessage);

        if (attempt < maxRetries) {
          const delay = attempt * 2000;
          console.log(`[MongoDB] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          this.isConnecting = false;
          throw new Error(`Failed to connect to MongoDB: ${errorMessage}`);
        }
      }
    }
    this.isConnecting = false;
  }

  /**
   * Gets the current MongoDB connection status
   */
  async getStatus(): Promise<MongoStatus> {
    if (!this.connection) {
      return {
        connected: false,
        readyState: 0, // disconnected
      };
    }

    const db = this.connection.connection;
    const readyState = db.readyState;

    return {
      connected: readyState === 1, // 1 = connected
      readyState,
      host: db.host || undefined,
      name: db.name || undefined,
    };
  }

  /**
   * Closes the MongoDB connection
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      await mongoose.disconnect();
      this.connection = null;
      console.log('[MongoDB] Disconnected');
    }
  }
}

// Singleton instance
const mongoClient = new MongoClient();

/**
 * Connects to MongoDB
 * @throws Error if connection fails
 */
export async function connectMongo(): Promise<void> {
  return mongoClient.connect();
}

/**
 * Gets the current MongoDB connection status
 */
export async function getMongoStatus(): Promise<MongoStatus> {
  return mongoClient.getStatus();
}

/**
 * Disconnects from MongoDB
 */
export async function disconnectMongo(): Promise<void> {
  return mongoClient.disconnect();
}

