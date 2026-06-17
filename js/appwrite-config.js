/**
 * GorkhaReels - Appwrite & Bunny CDN Configuration
 * All credentials and endpoints configured here
 */

// ============== APPWRITE CONFIG ==============
const APPWRITE_CONFIG = {
  ENDPOINT: 'https://fra.cloud.appwrite.io/v1',
  PROJECT_ID: 'gorkhareels',
  API_KEY: 'standard_c5223c61b268ebbdb18ba1d311e6d116371b4c44cd164c91b692650950e5cd014f629556a3d122fb27a621ff4f229941c668693e4091493b5ed9ccfe20deb8a7e430d59265f525092f0fa3044139e85d7a51caed348d77a6ff01e54a464e3e2d035e47bef385f13f7e25c4371966a39411c577582065607b451bed3a5a3e979d',
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

// ============== HELPER: Initialize Appwrite Client ==============
class AppwriteClient {
  constructor() {
    this.client = null;
    this.databases = null;
    this.account = null;
    this.init();
  }

  init() {
    // Create a simple HTTP client for Appwrite API
    this.baseURL = APPWRITE_CONFIG.ENDPOINT;
    this.projectId = APPWRITE_CONFIG.PROJECT_ID;
    this.apiKey = APPWRITE_CONFIG.API_KEY;
    this.databaseId = APPWRITE_CONFIG.DATABASE_ID;
  }

  /**
   * Make authenticated API call to Appwrite
   */
  async call(method, path, data = null) {
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Appwrite-Project': this.projectId,
          'X-Appwrite-Key': this.apiKey,
          'Access-Control-Allow-Credentials': 'true'
        }
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(`${this.baseURL}${path}`, options);
      
      if (!response.ok) {
        let error = null;
        try {
          error = await response.json();
        } catch (e) {
          error = { message: `HTTP ${response.status}` };
        }
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Appwrite API Error:', error);
      // Return user-friendly error
      throw new Error(error.message || 'Failed to connect to server. Please try again.');
    }
  }

  /**
   * Get documents from a collection
   */
  async getDocuments(collectionId, queries = []) {
    const queryString = queries.length ? `?${queries.join('&')}` : '';
    return this.call(
      'GET',
      `/databases/${this.databaseId}/collections/${collectionId}/documents${queryString}`
    );
  }

  /**
   * Get single document
   */
  async getDocument(collectionId, documentId) {
    return this.call(
      'GET',
      `/databases/${this.databaseId}/collections/${collectionId}/documents/${documentId}`
    );
  }

  /**
   * Create document
   */
  async createDocument(collectionId, data, documentId = null) {
    const id = documentId || this.generateId();
    return this.call(
      'POST',
      `/databases/${this.databaseId}/collections/${collectionId}/documents`,
      {
        documentId: id,
        data
      }
    );
  }

  /**
   * Update document
   */
  async updateDocument(collectionId, documentId, data) {
    return this.call(
      'PATCH',
      `/databases/${this.databaseId}/collections/${collectionId}/documents/${documentId}`,
      { data }
    );
  }

  /**
   * Delete document
   */
  async deleteDocument(collectionId, documentId) {
    return this.call(
      'DELETE',
      `/databases/${this.databaseId}/collections/${collectionId}/documents/${documentId}`
    );
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Query builder helper
   */
  query(field, operator, value) {
    if (operator === 'equal') return `queries[]=${field}=${value}`;
    if (operator === 'gt') return `queries[]=${field}%3E${value}`;
    if (operator === 'lt') return `queries[]=${field}%3C${value}`;
    if (operator === 'limit') return `limit=${value}`;
    if (operator === 'offset') return `offset=${value}`;
    if (operator === 'orderBy') return `orderBy[]=${value}`;
    return '';
  }
}

// ============== HELPER: Bunny CDN Upload ==============
class BunnyCDNClient {
  constructor() {
    this.apiKey = BUNNY_CONFIG.API_KEY;
    this.storageZone = BUNNY_CONFIG.STORAGE_ZONE;
    this.storageEndpoint = BUNNY_CONFIG.STORAGE_ENDPOINT;
    this.pullZoneUrl = BUNNY_CONFIG.PULL_ZONE_URL;
  }

  /**
   * Upload video to Bunny CDN
   */
  async uploadVideo(file, fileName) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `${this.storageEndpoint}${this.storageZone}/${fileName}`,
        {
          method: 'PUT',
          headers: {
            'AccessKey': this.apiKey
          },
          body: file
        }
      );

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      // Return the CDN URL
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

  /**
   * Delete video from Bunny CDN
   */
  async deleteVideo(fileName) {
    try {
      const response = await fetch(
        `${this.storageEndpoint}${this.storageZone}/${fileName}`,
        {
          method: 'DELETE',
          headers: {
            'AccessKey': this.apiKey
          }
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Bunny CDN Delete Error:', error);
      return false;
    }
  }

  /**
   * Generate thumbnail from video (using frame extraction)
   */
  generateThumbnailUrl(videoUrl, timeSeconds = 5) {
    // For now, return a placeholder
    // In production, you'd use Bunny's video encoding API
    return `${this.pullZoneUrl}thumbnails/${Date.now()}.jpg`;
  }
}

// ============== HELPER: Session Management ==============
class SessionManager {
  constructor() {
    this.currentUser = JSON.parse(localStorage.getItem('gorkha_user')) || null;
  }

  setUser(user) {
    this.currentUser = user;
    localStorage.setItem('gorkha_user', JSON.stringify(user));
  }

  getUser() {
    return this.currentUser;
  }

  isLoggedIn() {
    return this.currentUser !== null;
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('gorkha_user');
  }

  getUserId() {
    return this.currentUser?.userId || null;
  }
}

// ============== HELPER: Toast Notifications ==============
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

  static success(message) {
    this.show(message, 'success');
  }

  static error(message) {
    this.show(message, 'error');
  }
}

// ============== INITIALIZE GLOBALLY ==============
const appwrite = new AppwriteClient();
const bunny = new BunnyCDNClient();
const session = new SessionManager();

// Log initialization
console.log('✅ GorkhaReels Config Loaded');
console.log('API Endpoint:', APPWRITE_CONFIG.ENDPOINT);
console.log('Project:', APPWRITE_CONFIG.PROJECT_ID);
console.log('Database:', APPWRITE_CONFIG.DATABASE_ID);
console.log('Bunny CDN:', BUNNY_CONFIG.PULL_ZONE_URL);
