/**
 * GorkhaReels - Appwrite & Bunny CDN Configuration
 * ✅ Complete production config with all utilities
 * ✅ Messaging/DMs with real-time support
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
    REPORTS: 'reports',
    MESSAGES: 'messages'
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
    return databases.listDocuments(APPWRITE_CONFIG.DATABASE_ID, collectionId, queries);
  },
  async get(collectionId, documentId) {
    return databases.getDocument(APPWRITE_CONFIG.DATABASE_ID, collectionId, documentId);
  },
  async create(collectionId, data, documentId = null, permissions = null) {
    return databases.createDocument(
      APPWRITE_CONFIG.DATABASE_ID, collectionId,
      documentId || ID.unique(), data, permissions || undefined
    );
  },
  async update(collectionId, documentId, data) {
    return databases.updateDocument(APPWRITE_CONFIG.DATABASE_ID, collectionId, documentId, data);
  },
  async remove(collectionId, documentId) {
    return databases.deleteDocument(APPWRITE_CONFIG.DATABASE_ID, collectionId, documentId);
  }
};

// ============== STORAGE HELPER (Profile Pictures) ==============
const fileStorage = {
  async upload(bucketId, file) {
    try {
      const fileId = ID.unique();
      const permissions = [Permission.read(Role.any())];
      const uploadedFile = await storage.createFile(bucketId, fileId, file, permissions);
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
    return `${APPWRITE_CONFIG.ENDPOINT}/storage/buckets/${bucketId}/files/${fileId}/view?project=${APPWRITE_CONFIG.PROJECT_ID}`;
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
        { method: 'PUT', headers: { 'AccessKey': this.apiKey }, body: file }
      );
      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
      return { success: true, url: `${this.pullZoneUrl}${fileName}`, fileName };
    } catch (error) {
      console.error('Bunny CDN Upload Error:', error);
      throw error;
    }
  }

  async deleteVideo(fileName) {
    try {
      const response = await fetch(
        `${this.storageEndpoint}${this.storageZone}/${fileName}`,
        { method: 'DELETE', headers: { 'AccessKey': this.apiKey } }
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
  constructor() { this.currentUser = null; }
  async refresh() {
    try { this.currentUser = await account.get(); return this.currentUser; }
    catch (error) { this.currentUser = null; return null; }
  }
  getUser() { return this.currentUser; }
  getUserId() { return this.currentUser?.$id || null; }
  isLoggedIn() { return this.currentUser !== null; }
  async logout() {
    try { await account.deleteSession('current'); }
    catch (error) { console.error('Logout error:', error); }
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

// ============== REALTIME MESSAGING ==============
class RealtimeMessaging {
  constructor() {
    this.subscriptions = [];
  }

  subscribeToConversation(conversationId, callback) {
    const unsubscribe = appwriteClient.subscribe(
      `databases.${APPWRITE_CONFIG.DATABASE_ID}.collections.${APPWRITE_CONFIG.COLLECTIONS.MESSAGES}.documents`,
      (response) => {
        if (response.events.includes('databases.*.collections.*.documents.*.create')) {
          const msg = response.payload;
          if (msg.conversationId === conversationId) {
            callback(msg);
          }
        }
      }
    );
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  subscribeToMessageUpdate(messageId, callback) {
    const unsubscribe = appwriteClient.subscribe(
      `databases.${APPWRITE_CONFIG.DATABASE_ID}.collections.${APPWRITE_CONFIG.COLLECTIONS.MESSAGES}.documents.${messageId}`,
      (response) => {
        if (response.events.includes('databases.*.collections.*.documents.*.update')) {
          callback(response.payload);
        }
      }
    );
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  unsubscribeAll() {
    this.subscriptions.forEach(unsub => unsub());
    this.subscriptions = [];
  }
}

// ============== MEDIA UPLOADER ==============
class MediaUploader {
  constructor() {
    this.maxImageSize = 5 * 1024 * 1024;
    this.maxVideoSize = 50 * 1024 * 1024;
    this.maxVideoDuration = 30;
  }

  async uploadImage(file) {
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }
    if (file.size > this.maxImageSize) {
      throw new Error('Image must be less than 5MB');
    }

    const fileName = `msg_img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return bunny.uploadVideo(file, fileName);
  }

  async uploadVideo(file) {
    if (!file.type.startsWith('video/')) {
      throw new Error('File must be a video');
    }
    if (file.size > this.maxVideoSize) {
      throw new Error('Video must be less than 50MB');
    }

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.onloadedmetadata = async () => {
        if (video.duration > this.maxVideoDuration) {
          reject(new Error(`Video must be ${this.maxVideoDuration} seconds or less`));
          return;
        }

        try {
          const fileName = `msg_vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const result = await bunny.uploadVideo(file, fileName);
          const thumbnail = await this.generateVideoThumbnail(video);
          resolve({ ...result, thumbnail });
        } catch (error) {
          reject(error);
        }
      };
      video.onerror = () => reject(new Error('Invalid video file'));
      video.src = URL.createObjectURL(file);
    });
  }

  generateVideoThumbnail(video) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    });
  }
}

// ============== CONVERSATION MANAGER ==============
class ConversationManager {
  static getConversationId(userId1, userId2) {
    const sorted = [userId1, userId2].sort();
    return sorted.join('_');
  }

  static async getUserConversations(userId) {
    try {
      const results = await db.list('messages', [
        Query.or([
          Query.equal('senderId', userId),
          Query.equal('recipientId', userId)
        ]),
        Query.orderDesc('createdAt'),
        Query.limit(100)
      ]);

      const conversations = {};
      results.documents.forEach(msg => {
        const convId = this.getConversationId(msg.senderId, msg.recipientId);
        if (!conversations[convId] || msg.createdAt > conversations[convId].createdAt) {
          conversations[convId] = {
            conversationId: convId,
            lastMessage: msg,
            unread: msg.recipientId === userId && !msg.isRead
          };
        }
      });

      return Object.values(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
  }

  static async getConversationMessages(conversationId, limit = 50) {
    try {
      const results = await db.list('messages', [
        Query.equal('conversationId', conversationId),
        Query.orderDesc('createdAt'),
        Query.limit(limit)
      ]);
      return results.documents.reverse();
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  static async sendMessage(senderId, recipientId, messageText, messageType = 'text', mediaUrl = null, mediaThumbnail = null) {
    try {
      const conversationId = this.getConversationId(senderId, recipientId);
      
      const messageData = {
        messageText,
        messageType,
        mediaUrl,
        mediaThumbnail,
        conversationId,
        senderId,
        recipientId,
        isRead: false,
        createdAt: new Date().toISOString()
      };

      // No document-level permissions - relies on collection-level (Users role)
      // Appwrite blocks granting read/update to OTHER users at create time,
      // so we use collection-level security instead (set in Appwrite Console)
      const result = await databases.createDocument(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.COLLECTIONS.MESSAGES,
        ID.unique(),
        messageData
      );
      
      return result;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  static async markAsRead(messageId) {
    try {
      await db.update('messages', messageId, {
        isRead: true,
        readAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }

  static async deleteMessage(messageId) {
    try {
      await db.remove('messages', messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }
}

// ============== INITIALIZE ==============
const bunny = new BunnyCDNClient();
const session = new SessionManager();
const realtime = new RealtimeMessaging();
const mediaUploader = new MediaUploader();

console.log('✅ GorkhaReels Config Loaded');
console.log('✅ Globals: ID, Query, Permission, Role');
console.log('✅ Classes: BunnyCDNClient, SessionManager, Toast, RealtimeMessaging, MediaUploader');
console.log('✅ Helpers: db, fileStorage, ConversationManager, escapeHtml');
console.log('✅ Messaging System Ready');
