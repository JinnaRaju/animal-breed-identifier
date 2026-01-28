
import { User, BreedResult, UserRole } from '../types';

const DB_NAME = 'AnimalBreedFinderDB';
const DB_VERSION = 1;

export class AnimalDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Use the returned object store from createObjectStore instead of accessing non-existent property on db.transaction
        if (!db.objectStoreNames.contains('users')) {
          const userStore = db.createObjectStore('users', { keyPath: 'id' });
          userStore.createIndex('email', 'email', { unique: true });
        }

        // Use the returned object store from createObjectStore instead of accessing non-existent property on db.transaction
        if (!db.objectStoreNames.contains('scans')) {
          const scanStore = db.createObjectStore('scans', { keyPath: 'id' });
          scanStore.createIndex('userId', 'userId', { unique: false });
          scanStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // --- User Operations ---

  async saveUser(user: User): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['users'], 'readwrite');
      const store = transaction.objectStore('users');
      const request = store.put(user);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUser(id: string): Promise<User | null> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['users'], 'readonly');
      const store = transaction.objectStore('users');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['users'], 'readonly');
      const store = transaction.objectStore('users');
      const index = store.index('email');
      const request = index.get(email);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllUsers(): Promise<User[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['users'], 'readonly');
      const store = transaction.objectStore('users');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // --- Scan Operations ---

  async saveScan(scan: BreedResult): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['scans'], 'readwrite');
      const store = transaction.objectStore('scans');
      const request = store.put(scan);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUserScans(userId: string): Promise<BreedResult[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['scans'], 'readonly');
      const store = transaction.objectStore('scans');
      const index = store.index('userId');
      const request = index.getAll(userId);
      request.onsuccess = () => {
        // Sort by timestamp descending
        const scans = request.result as BreedResult[];
        resolve(scans.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllScans(): Promise<BreedResult[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['scans'], 'readonly');
      const store = transaction.objectStore('scans');
      const request = store.getAll();
      request.onsuccess = () => {
        const scans = request.result as BreedResult[];
        resolve(scans.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteScan(id: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['scans'], 'readwrite');
      const store = transaction.objectStore('scans');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- Seeding ---
  async seedAdmin(): Promise<void> {
    const adminEmail = 'admin@breedfinder.com';
    const existing = await this.getUserByEmail(adminEmail);
    if (!existing) {
      await this.saveUser({
        id: 'admin-1',
        name: 'System Administrator',
        email: adminEmail,
        role: UserRole.ADMIN,
        createdAt: new Date().toISOString()
      });
    }
  }
}

export const db = new AnimalDB();
