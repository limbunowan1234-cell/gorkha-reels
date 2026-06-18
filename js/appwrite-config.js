/**
 * GorkhaReels - Appwrite & Bunny CDN Configuration (FIXED)
 * 
 * FIXES APPLIED:
 * ✅ FIX #1: ID & Query now exposed as globals
 * ✅ FIX #2: API key moved to backend (no longer in frontend)
 * ✅ FIX #21: Descriptions will be escaped by feed.js
 * 
 * IMPORTANT: The Appwrite SDK must be loaded BEFORE this file:
 * <script src="https://cdn.jsdelivr.net/npm/appwrite@18"></script>
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
  }
};

// ============== BUNNY CDN CONFIG (FIXED) ==============
// ⚠️ SECURITY: API_KEY is NO LONGER stored here
// Instead, use your backend API endpoint to handle uploads securely
const BUNNY_CONFIG = {
  STORAGE_ZONE: 'gorkhareels',
  PULL_ZONE_URL: 'https://gorkhareel-video.b-cdn.net/',
  // Point this to your backend server that handles Bunny uploads securely
  // Example: https://your-backend.com/api/upload
  // The backend receives the file, uploads to Bunny with the API key, returns the URL
  BACKEND_UPLOAD_URL: 'https://your-backend.com/api/upload', // ← UPDATE THIS
  BACKEND_DELETE_URL: 'https://your-backend.com/api/delete'  // ← UPDATE THIS
};

// ============== INITIALIZE APPWRITE SDK ==============
const { Client, Account, Databases, Query, ID, Permission, Role } = Appwrite;

const appwriteClient = new Client()
  .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
  .setProject(APPWRITE_CONFIG.PROJECT_ID);

const account = new Account(appwriteClient);
const databases = new Databases(appwriteClient);

// ============== FIX #1: EXPOSE GLOBALS ==============
// These are now available globally so other scripts can use them
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

// ============== BUNNY CDN CLIENT (FIXED) ==============
// FIX #2: Now uses backend endpoint instead of direct API key
class BunnyCDNClient {
  constructor() {
    this.storageZone = BUNNY_CONFIG.STORAGE_ZONE;
    this.pullZoneUrl = BUNNY_CONFIG.PULL_ZONE_URL;
    this.backendUrl = BUNNY_CONFIG.BACKEND_UPLOAD_URL;
  }

  async uploadVideo(file, fileName) {
    try {
      // Create FormData with file and metadata
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', fileName);
      formData.append('storageZone', this.storageZone);

      // Send to your backend (backend handles Bunny API key securely)
      const response = await fetch(this.backendUrl, {
        method: 'POST',
        body: formData
        // NO Authorization header with API key (that stays on backend!)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error.message || `Upload failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Upload failed on server');
      }

      return {
        success: true,
        url: data.url, // Backend returns the full pull zone URL
        fileName: data.fileName
      };
    } catch (error) {
      console.error('Upload Error:', error);
      throw error;
    }
  }

  async deleteVideo(fileName) {
    try {
      const response = await fetch(`${BUNNY_CONFIG.BACKEND_DELETE_URL}/${fileName}`, {
        method: 'DELETE'
      });
      return response.ok;
    } catch (error) {
      console.error('Delete Error:', error);
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
  static info(message) { this.show(message, 'info'); }
}

// ============== UTILITY: ESCAPE HTML (FIX #21) ==============
// Prevent XSS by escaping user-generated content
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// ============== INITIALIZE GLOBALLY ==============
const bunny = new BunnyCDNClient();
const session = new SessionManager();

console.log('✅ GorkhaReels Config Loaded (Appwrite Web SDK)');
console.log('✅ Globals exposed: ID, Query, Permission, Role');
console.log('⚠️  Backend upload configured (API key secure)');
console.log('Endpoint:', APPWRITE_CONFIG.ENDPOINT);
console.log('Project:', APPWRITE_CONFIG.PROJECT_ID);
