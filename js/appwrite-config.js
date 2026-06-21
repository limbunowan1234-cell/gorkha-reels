/**
 * GorkhaReels - Appwrite & Bunny CDN Configuration
 * ✅ Complete production config with all utilities
 * ✅ Works on GitHub Pages (no backend needed)
 * ✅ Storage support for profile pictures
 */

// ============== APPWRITE CONFIG ==============
const APPWRITE_CONFIG = {
  ENDPOINT: 'https://fra.cloud.appwrite.io/v1',
  PROJECT_ID: 'gorkhareels',
  DATABASE_ID: 'gorkha_db',

  COLLECTIONS: {
    CREATORS: 'creators',
    REELS: 'reels',
    COMMENTS: 'comments',
    LIKES: 'likes',
    EARNINGS: 'earnings',
    FOLLOWERS: 'followers',
    TRENDING: 'trending',
    REPORTS: 'reports'
  },

  BUCKETS: {
    PROFILE_PICS: 'profilePic'
  }
};

// ============== BUNNY CDN CONFIG ==============
const BUNNY_CONFIG = {
  API_KEY: 'cf694f78-8568-4497-9e764c8848c4-728e-4d89',
  STORAGE_ZONE: 'gorkhareels',
  PULL_ZONE_URL: 'https://gorkhareel-video.b-cdn.net/',
  STORAGE_ENDPOINT: 'https://storage.bunnycdn.com/'
};

// ============== INITIALIZE APPWRITE SDK ==============
const { Client, Account, Databases, Storage, Query, ID, Permission, Role } = Appwrite;

const appwriteClient = new Client()
  .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
  .setProject(APPWRITE_CONFIG.PROJECT_ID);

const account = new Account(appwriteClient);
const databases = new Databases(appwriteClient);
const storage = new Storage(appwriteClient);

// ============== EXPOSE GLOBALS ==============
window.ID = ID;
window.Query = Query;
window.Permission = Permission;
window.Role = Role;

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

// ============== STORAGE HELPER (Profile Pictures) ==============
const fileStorage = {
  async upload(bucketId, file) {
    try {
      const fileId = ID.unique();
      const uploadedFile = await storage.createFile(bucketId, fileId, file);
      return uploadedFile;
    } catch (error) {
      console.error('Storage upload error:', error);
      throw error;
    }
  },

  async delete(bucketId, fileId) {
    try {
      return await storage.deleteFile(bucketId, fileId);
    } catch (error) {
      console.error('Storage delete error:', error);
      throw error;
    }
  },

  getFileUrl(bucketId, fileId) {
    return `${APPWRITE_CONFIG.ENDPOINT}/storage/buckets/${bucketId}/files/${fileId}/preview?project=${APPWRITE_CONFIG.PROJECT_ID}&width=200&height=200&gravity=center&quality=80`;
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

  getUser() { return this.currentUser; }
  getUserId() { return this.currentUser?.$id || null; }
  isLoggedIn() { return this.currentUser !== null; }

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
  static info(message) { this.show(message, 'info'); }
}

// ============== ESCAPE HTML (XSS Prevention) ==============
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ============== INITIALIZE ==============
const bunny = new BunnyCDNClient();
const session = new SessionManager();

console.log('✅ GorkhaReels Config Loaded');
console.log('✅ Globals: ID, Query, Permission, Role');
console.log('✅ Classes: BunnyCDNClient, SessionManager, Toast');
console.log('✅ Helper: db, fileStorage, escapeHtml');
