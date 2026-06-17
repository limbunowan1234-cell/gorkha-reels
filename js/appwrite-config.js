/**
 * GorkhaReels - Appwrite & Bunny CDN Configuration
 * Uses the official Appwrite Web SDK (loaded via CDN in HTML)
 *
 * IMPORTANT: The Appwrite SDK must be loaded BEFORE this file:
 * <script src="https://cdn.jsdelivr.net/npm/appwrite@18"></script>
 */

// ============== APPWRITE CONFIG ==============
const APPWRITE_CONFIG = {
  ENDPOINT: 'https://fra.cloud.appwrite.io/v1',
  PROJECT_ID: 'gorkhareels',
  DATABASE_ID: 'gorka_db',

  COLLECTIONS: {
    CREATORS: 'creators',
    REELS: 'reels',
    COMMENTS: 'comments',
    LIKES: 'likes',
    EARNINGS: 'earnings',
    FOLLOWERS: 'followers',
    TRENDING: 'trending',
    REPORTS: 'reports'
  }
};

// ============== BUNNY CDN CONFIG ==============
const BUNNY_CONFIG = {
  API_KEY: 'c8e90f7f-5178-465d-b0d0-5a818fe5856e5ac756c5-2d50-4796-959f-721f70256804',
  STORAGE_ZONE: 'gorkhareel',
  PULL_ZONE_URL: 'https://gorkhareel-video.b-cdn.net/',
  STORAGE_ENDPOINT: 'https://storage.bunnycdn.com/'
};

// ============== INITIALIZE APPWRITE SDK ==============
// The 'Appwrite' global comes from the CDN script tag
const { Client, Account, Databases, Query, ID, Permission, Role } = Appwrite;

const appwriteClient = new Client()
  .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
  .setProject(APPWRITE_CONFIG.PROJECT_ID);

const account = new Account(appwriteClient);
const databases = new Databases(appwriteClient);

// ============== DATABASE HELPER ==============
const db = {
  async list(collectionId, queries = []) {
    return databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      collectionId,
      queries
    );
  },

  async get(collectionId, documentId) {
    return databases.getDocument(
      APPWRITE_CONFIG.DATABASE_ID,
      collectionId,
      documentId
    );
  },

  async create(collectionId, data, documentId = null, permissions = null) {
    return databases.createDocument(
      APPWRITE_CONFIG.DATABASE_ID,
      collectionId,
      documentId || ID.unique(),
      data,
      permissions || undefined
    );
  },

  async update(collectionId, documentId, data) {
    return databases.updateDocument(
      APPWRITE_CONFIG.DATABASE_ID,
      collectionId,
      documentId,
      data
    );
  },

  async remove(collectionId, documentId) {
    return databases.deleteDocument(
      APPWRITE_CONFIG.DATABASE_ID,
      collectionId,
      documentId
    );
  }
};

// ============== BUNNY CDN CLIENT ==============
class BunnyCDNClient {
  constructor() {
    this.apiKey = BUNNY_CONFIG.API_KEY;
    this.storageZone = BUNNY_CONFIG.STORAGE_ZONE;
    this.storageEndpoint = BUNNY_CONFIG.STORAGE_ENDPOINT;
    this.pullZoneUrl = BUNNY_CONFIG.PULL_ZONE_URL;
  }

  async uploadVideo(file, fileName) {
    try {
      const response = await fetch(
        `${this.storageEndpoint}${this.storageZone}/${fileName}`,
        {
          method: 'PUT',
          headers: { 'AccessKey': this.apiKey },
          body: file
        }
      );

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      return {
        success: true,
        url: `${this.pullZoneUrl}${fileName}`,
        fileName: fileName
      };
    } catch (error) {
      console.error('Bunny CDN Upload Error:', error);
      throw error;
    }
  }

  async deleteVideo(fileName) {
    try {
      const response = await fetch(
        `${this.storageEndpoint}${this.storageZone}/${fileName}`,
        {
          method: 'DELETE',
          headers: { 'AccessKey': this.apiKey }
        }
      );
      return response.ok;
    } catch (error) {
      console.error('Bunny CDN Delete Error:', error);
      return false;
    }
  }
}

// ============== SESSION MANAGER ==============
class SessionManager {
  constructor() {
    this.currentUser = null;
  }

  async refresh() {
    try {
      this.currentUser = await account.get();
      return this.currentUser;
    } catch (error) {
      this.currentUser = null;
      return null;
    }
  }

  getUser() {
    return this.currentUser;
  }

  getUserId() {
    return this.currentUser?.$id || null;
  }

  isLoggedIn() {
    return this.currentUser !== null;
  }

  async logout() {
    try {
      await account.deleteSession('current');
    } catch (error) {
      console.error('Logout error:', error);
    }
    this.currentUser = null;
  }
}

// ============== TOAST NOTIFICATIONS ==============
class Toast {
  static show(message, type = 'success', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideDown 0.3s ease-out forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  static success(message) { this.show(message, 'success'); }
  static error(message) { this.show(message, 'error'); }
}

// ============== INITIALIZE GLOBALLY ==============
const bunny = new BunnyCDNClient();
const session = new SessionManager();

console.log('✅ GorkhaReels Config Loaded (Appwrite Web SDK)');
console.log('Endpoint:', APPWRITE_CONFIG.ENDPOINT);
console.log('Project:', APPWRITE_CONFIG.PROJECT_ID);
