/**
 * GorkhaReels - Notifications Manager
 * 
 * Handles:
 * - Loading notifications
 * - Marking as read
 * - Deleting notifications
 * - Badge updates
 * - Real-time notification sounds
 */

class NotificationsManager {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
    this.userId = null;
    this.init();
  }

  async init() {
    await session.refresh();
    if (!session.isLoggedIn()) {
      console.log('Not logged in, skipping notifications');
      return;
    }

    this.userId = session.getUserId();
    console.log('✅ Notifications Manager initialized for user:', this.userId);

    // Load initial notifications
    await this.loadNotifications();

    // Update badge
    this.updateBadge();

    // Set up periodic refresh (every 15 seconds)
    setInterval(() => this.loadNotifications(), 15000);
  }

  async loadNotifications() {
    if (!this.userId) return;

    try {
      const response = await db.list(APPWRITE_CONFIG.COLLECTIONS.NOTIFICATIONS, [
        Query.equal('userId', this.userId),
        Query.orderDesc('createdAt'),
        Query.limit(50)
      ]);

      this.notifications = response.documents || [];
      this.unreadCount = this.notifications.filter(n => !n.isRead).length;

      // Update badge
      this.updateBadge();

      console.log(`✅ Loaded ${this.notifications.length} notifications (${this.unreadCount} unread)`);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }

  updateBadge() {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;

    if (this.unreadCount > 0) {
      badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  async markAsRead(notificationId) {
    try {
      await db.update(APPWRITE_CONFIG.COLLECTIONS.NOTIFICATIONS, notificationId, {
        isRead: true
      });

      const notif = this.notifications.find(n => n.$id === notificationId);
      if (notif) {
        notif.isRead = true;
        this.unreadCount = Math.max(0, this.unreadCount - 1);
        this.updateBadge();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  async markAllAsRead() {
    try {
      const unread = this.notifications.filter(n => !n.isRead);
      
      for (const notif of unread) {
        await this.markAsRead(notif.$id);
      }

      Toast.success('✅ All marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }

  async deleteNotification(notificationId) {
    try {
      await db.remove(APPWRITE_CONFIG.COLLECTIONS.NOTIFICATIONS, notificationId);

      this.notifications = this.notifications.filter(n => n.$id !== notificationId);
      this.unreadCount = this.notifications.filter(n => !n.isRead).length;
      this.updateBadge();

      // Refresh the panel if it's open
      this.displayNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }

  displayNotifications() {
    const panel = document.getElementById('notifications-panel');
    if (!panel) return;

    if (this.notifications.length === 0) {
      panel.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: #888;">
          <div style="font-size: 48px; margin-bottom: 12px;">🔔</div>
          <p>No notifications yet</p>
        </div>
      `;
      return;
    }

    const html = this.notifications.map(notif => {
      const icon = this.getNotificationIcon(notif.type);
      const timeAgo = this.getTimeAgo(new Date(notif.createdAt));

      return `
        <div style="padding: 12px 16px; border-bottom: 1px solid #2d2d2d; display: flex; justify-content: space-between; align-items: center; cursor: pointer; background: ${notif.isRead ? 'transparent' : 'rgba(11, 94, 107, 0.1)'};" 
             onclick="${notif.actionUrl ? `window.location='${notif.actionUrl}'` : 'void(0)'}">
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 14px; color: #fff; font-weight: 600; margin-bottom: 4px;">
              ${icon} ${escapeHtml(notif.message)}
            </div>
            <div style="font-size: 11px; color: #888;">
              ${timeAgo}
            </div>
          </div>
          <button 
            style="background: none; border: none; color: #dc2626; font-size: 18px; cursor: pointer; padding: 4px 8px; margin-left: 8px;"
            onclick="event.stopPropagation(); window.notificationsManager.deleteNotification('${notif.$id}')"
            title="Delete">
            ✕
          </button>
        </div>
      `;
    }).join('');

    panel.innerHTML = `
      <div style="padding: 12px 16px; border-bottom: 1px solid #2d2d2d; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 16px; font-weight: 700; color: #fff;">🔔 Notifications</div>
        ${this.unreadCount > 0 ? `<button style="background: #0B5E6B; border: none; color: #fff; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; cursor: pointer;" onclick="window.notificationsManager.markAllAsRead()">Mark all read</button>` : ''}
      </div>
      ${html}
    `;
  }

  getNotificationIcon(type) {
    const icons = {
      'tagged': '🏷️',
      'liked': '❤️',
      'followed': '👥',
      'shared': '📤',
      'commented': '💬',
      'default': '🔔'
    };
    return icons[type] || icons['default'];
  }

  getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  // Static method to CREATE a notification
  static async createNotification(userId, fromCreatorId, type, message, reelId = null, actionUrl = null) {
    try {
      await db.create(APPWRITE_CONFIG.COLLECTIONS.NOTIFICATIONS, {
        notificationId: ID.unique(),
        userId: userId,
        fromCreatorId: fromCreatorId,
        type: type,
        message: message,
        reelId: reelId || '',
        isRead: false,
        createdAt: new Date().toISOString(),
        actionUrl: actionUrl || ''
      });

      console.log(`✅ Notification created for ${userId}: ${message}`);
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }
}

// Initialize globally
let notificationsManager = null;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    notificationsManager = new NotificationsManager();
  });
} else {
  notificationsManager = new NotificationsManager();
}

console.log('✅ Notifications Manager Loaded');
