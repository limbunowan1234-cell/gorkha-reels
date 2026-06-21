// Appwrite SDK v18 Configuration
const { Client, Account, Databases, Storage, Query, ID, Permission, Role } = Appwrite;

const APPWRITE_CONFIG = {
  endpoint: 'https://fra.cloud.appwrite.io/v1',
  projectId: 'gorkha-reels',
  COLLECTIONS: {
    REELS: 'reels',
    CREATORS: 'creators',
    COMMENTS: 'comments',
    LIKES: 'likes',
    FOLLOWERS: 'followers',
    REPORTS: 'reports'
  },
  BUCKETS: {
    PROFILE_PICS: 'profilePic'
  }
};

const BUNNY_CONFIG = {
  ZONE_NAME: 'gorkha-reels-videos',
  API_KEY: '49ae9fa6-f8b4-4b10-97b8fcbcd61cc3f6e6df',
  PULL_ZONE_URL: 'https://gorkha-reels-videos.b-cdn.net'
};

// Initialize Appwrite Client
const appwriteClient = new Client()
  .setEndpoint(APPWRITE_CONFIG.endpoint)
  .setProject(APPWRITE_CONFIG.projectId);

const account = new Account(appwriteClient);
const databases = new Databases(appwriteClient);
const storage = new Storage(appwriteClient);

// ===== SESSION MANAGER =====
const session = {
  async refresh() {
    try {
      this.currentUser = await account.get();
      return this.currentUser;
    } catch (err) {
      this.currentUser = null;
      throw err;
    }
  },
  isLoggedIn() {
    return !!this.currentUser?.email;
  },
  getUserId() {
    return this.currentUser?.$id;
  },
  async logout() {
    await account.deleteSession('current');
    this.currentUser = null;
  },
  currentUser: null
};

// ===== DATABASE WRAPPER =====
const db = {
  async list(collectionId, queries = []) {
    return await databases.listDocuments(APPWRITE_CONFIG.projectId, collectionId, queries);
  },
  async get(collectionId, docId) {
    return await databases.getDocument(APPWRITE_CONFIG.projectId, collectionId, docId);
  },
  async create(collectionId, data, docId = null) {
    const finalId = docId || ID.unique();
    return await databases.createDocument(
      APPWRITE_CONFIG.projectId,
      collectionId,
      finalId,
      data
    );
  },
  async update(collectionId, docId, data) {
    return await databases.updateDocument(APPWRITE_CONFIG.projectId, collectionId, docId, data);
  },
  async remove(collectionId, docId) {
    return await databases.deleteDocument(APPWRITE_CONFIG.projectId, collectionId, docId);
  }
};

// ===== STORAGE WRAPPER (for profile pictures) =====
const fileStorage = {
  async upload(bucketId, file) {
    const fileId = ID.unique();
    const uploadedFile = await storage.createFile(bucketId, fileId, file);
    return uploadedFile;
  },
  async delete(bucketId, fileId) {
    return await storage.deleteFile(bucketId, fileId);
  },
  getFileUrl(bucketId, fileId) {
    // Returns the public URL for the file
    return `${APPWRITE_CONFIG.endpoint}/storage/buckets/${bucketId}/files/${fileId}/preview?project=${APPWRITE_CONFIG.projectId}&width=200&height=200&gravity=center&quality=80`;
  }
};

// ===== BUNNY CDN CLIENT =====
class BunnyCDNClient {
  constructor(apiKey, zoneName, pullZoneUrl) {
    this.apiKey = apiKey;
    this.zoneName = zoneName;
    this.pullZoneUrl = pullZoneUrl;
  }

  async uploadVideo(file, filename) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `https://storage.bunnycdn.com/${this.zoneName}/${filename}`,
      {
        method: 'PUT',
        headers: { 'AccessKey': this.apiKey },
        body: file
      }
    );

    if (!response.ok) throw new Error(`Bunny upload failed: ${response.statusText}`);
    return `${this.pullZoneUrl}/${filename}`;
  }

  async deleteVideo(filename) {
    const response = await fetch(
      `https://storage.bunnycdn.com/${this.zoneName}/${filename}`,
      { method: 'DELETE', headers: { 'AccessKey': this.apiKey } }
    );
    return response.ok;
  }
}

const bunny = new BunnyCDNClient(BUNNY_CONFIG.API_KEY, BUNNY_CONFIG.ZONE_NAME, BUNNY_CONFIG.PULL_ZONE_URL);

// ===== UTILITIES =====
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}

const Toast = {
  success(msg) { console.log('✅', msg); },
  error(msg) { console.error('❌', msg); },
  info(msg) { console.log('ℹ️', msg); }
};

function showToast(msg, isError = false) {
  isError ? Toast.error(msg) : Toast.success(msg);
}

// Export for browser
window.db = db;
window.session = session;
window.fileStorage = fileStorage;
window.bunny = bunny;
window.escapeHtml = escapeHtml;
window.Toast = Toast;
window.showToast = showToast;
window.Query = Query;
window.ID = ID;
window.Permission = Permission;
window.Role = Role;
window.APPWRITE_CONFIG = APPWRITE_CONFIG;
window.BUNNY_CONFIG = BUNNY_CONFIG;
