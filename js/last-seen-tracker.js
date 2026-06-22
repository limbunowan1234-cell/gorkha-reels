/**
 * GorkhaReels Last Seen Tracker
 * Simple: just tracks lastSeen timestamp, no fake online/offline status
 */

class LastSeenTracker {
  constructor() {
    this.currentUserId = null;
    this.updateInterval = null;
  }

  /**
   * Initialize tracking
   * Call when user logs in
   */
  async init(userId) {
    this.currentUserId = userId;
    
    // Update lastSeen immediately
    await this.updateLastSeen();
    
    // Update every 60 seconds
    this.startTracking();
    
    console.log('✅ Last Seen Tracker initialized');
  }

  /**
   * Update lastSeen timestamp
   */
  async updateLastSeen() {
    if (!this.currentUserId) return;
    
    try {
      const now = new Date().toISOString();
      await db.update('creators', this.currentUserId, {
        lastSeen: now
      });
    } catch (error) {
      console.error('Error updating lastSeen:', error);
    }
  }

  /**
   * Start periodic updates every 60 seconds
   */
  startTracking() {
    this.updateInterval = setInterval(() => {
      this.updateLastSeen();
    }, 60 * 1000); // Every minute
  }

  /**
   * Stop tracking on logout
   */
  stopTracking() {
    clearInterval(this.updateInterval);
  }

  /**
   * Format lastSeen timestamp into readable text
   * Returns: "Last seen 30m ago", "Last seen just now", etc
   */
  static formatLastSeen(lastSeenIso) {
    if (!lastSeenIso) {
      return 'Last seen never';
    }

    const lastSeen = new Date(lastSeenIso);
    const now = new Date();
    const diffMs = now - lastSeen;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Last seen just now';
    if (diffMin < 60) return `Last seen ${diffMin}m ago`;
    if (diffHours < 24) return `Last seen ${diffHours}h ago`;
    if (diffDays < 30) return `Last seen ${diffDays}d ago`;
    
    return `Last seen ${lastSeen.toLocaleDateString()}`;
  }
}

// Initialize globally
const lastSeenTracker = new LastSeenTracker();

console.log('✅ Last Seen System Ready');
