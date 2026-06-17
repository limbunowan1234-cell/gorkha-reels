/**
 * GorkhaReels - Creator Dashboard
 * Stats, earnings, and profile management
 */

class DashboardManager {
  constructor() {
    if (!session.isLoggedIn()) {
      this.redirectToLogin();
      return;
    }

    this.user = session.getUser();
    this.creatorData = null;
    this.myReels = [];

    this.init();
  }

  async init() {
    console.log('Initializing Dashboard...');
    await this.loadCreatorData();
    await this.loadMyReels();
    await this.loadEarnings();
    this.setupEventListeners();
  }

  /**
   * Load creator profile data
   */
  async loadCreatorData() {
    try {
      this.creatorData = await appwrite.getDocument(
        APPWRITE_CONFIG.COLLECTIONS.CREATORS,
        this.user.userId
      );

      this.displayProfile();
    } catch (error) {
      console.error('Error loading creator data:', error);
      Toast.error('Failed to load profile');
    }
  }

  /**
   * Display profile information
   */
  displayProfile() {
    if (!this.creatorData) return;

    // Update profile header
    const nameEl = document.getElementById('creator-name');
    if (nameEl) nameEl.textContent = this.creatorData.name;

    const bioEl = document.getElementById('creator-bio');
    if (bioEl) bioEl.textContent = this.creatorData.bio || 'No bio yet';

    const avatarEl = document.getElementById('creator-avatar');
    if (avatarEl) {
      avatarEl.src = this.creatorData.profilePic || 'https://via.placeholder.com/80';
    }

    // Update stats
    const followersEl = document.getElementById('followers-count');
    if (followersEl) followersEl.textContent = this.creatorData.followers || 0;

    const viewsEl = document.getElementById('total-views');
    if (viewsEl) viewsEl.textContent = this.formatNumber(this.creatorData.totalViews || 0);

    const reelsEl = document.getElementById('total-reels');
    if (reelsEl) reelsEl.textContent = this.creatorData.totalReels || 0;

    console.log('✅ Profile loaded:', this.creatorData.name);
  }

  /**
   * Load creator's reels
   */
  async loadMyReels() {
    try {
      const response = await appwrite.getDocuments(
        APPWRITE_CONFIG.COLLECTIONS.REELS,
        [
          `queries[]=creatorId=${this.user.userId}`,
          `orderBy[]=uploadedAt`,
          `limit=50`
        ]
      );

      this.myReels = response.documents;
      this.displayMyReels();

      console.log(`✅ Loaded ${this.myReels.length} reels`);
    } catch (error) {
      console.error('Error loading my reels:', error);
      Toast.error('Failed to load your reels');
    }
  }

  /**
   * Display creator's reels
   */
  displayMyReels() {
    const reelsContainer = document.getElementById('my-reels-container');
    if (!reelsContainer) return;

    if (this.myReels.length === 0) {
      reelsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
          <p>No videos uploaded yet</p>
          <a href="/upload.html" class="btn btn-primary" style="max-width: 300px; margin-top: 20px;">
            Upload Your First Video
          </a>
        </div>
      `;
      return;
    }

    reelsContainer.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        ${this.myReels.map(reel => this.renderReelCard(reel)).join('')}
      </div>
    `;
  }

  /**
   * Render reel card
   */
  renderReelCard(reel) {
    const date = new Date(reel.uploadedAt).toLocaleDateString();
    
    return `
      <div style="
        background: var(--dark-card);
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid var(--border-color);
        cursor: pointer;
      " onclick="window.open('/?reel=${reel.$id}', '_blank')">
        <div style="
          position: relative;
          padding-bottom: 56.25%;
          height: 0;
          overflow: hidden;
          background: var(--dark-bg);
        ">
          <img src="${reel.thumbnail}" style="
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
          " alt="${reel.title}">
          <div style="
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
          ">${reel.views || 0} views</div>
        </div>
        <div style="padding: 12px;">
          <p style="
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 6px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          ">${reel.title}</p>
          <div style="
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: var(--text-secondary);
          ">
            <span>❤️ ${reel.likes || 0}</span>
            <span>💬 ${reel.comments || 0}</span>
            <span>${date}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Load earnings data
   */
  async loadEarnings() {
    try {
      const response = await appwrite.getDocuments(
        APPWRITE_CONFIG.COLLECTIONS.EARNINGS,
        [
          `queries[]=creatorId=${this.user.userId}`,
          `queries[]=status=completed`,
          `orderBy[]=createdAt`
        ]
      );

      this.calculateAndDisplayEarnings(response.documents);
    } catch (error) {
      console.error('Error loading earnings:', error);
      // Set default earnings display
      this.displayEarnings({
        totalEarnings: 0,
        adRevenue: 0,
        tips: 0,
        sponsorship: 0
      });
    }
  }

  /**
   * Calculate earnings
   */
  calculateAndDisplayEarnings(earnings) {
    const summary = {
      totalEarnings: 0,
      adRevenue: 0,
      tips: 0,
      sponsorship: 0
    };

    earnings.forEach(earning => {
      summary.totalEarnings += earning.amount || 0;
      
      if (earning.type === 'ad-revenue') {
        summary.adRevenue += earning.amount || 0;
      } else if (earning.type === 'tips') {
        summary.tips += earning.amount || 0;
      } else if (earning.type === 'sponsorship') {
        summary.sponsorship += earning.amount || 0;
      }
    });

    this.displayEarnings(summary);
  }

  /**
   * Display earnings
   */
  displayEarnings(earnings) {
    const totalEl = document.getElementById('total-earnings');
    if (totalEl) {
      totalEl.textContent = `₹ ${earnings.totalEarnings.toFixed(2)}`;
    }

    const adEl = document.getElementById('ad-revenue');
    if (adEl) {
      adEl.textContent = `₹ ${earnings.adRevenue.toFixed(2)}`;
    }

    const tipsEl = document.getElementById('tips-earnings');
    if (tipsEl) {
      tipsEl.textContent = `₹ ${earnings.tips.toFixed(2)}`;
    }

    const sponsorEl = document.getElementById('sponsor-earnings');
    if (sponsorEl) {
      sponsorEl.textContent = `₹ ${earnings.sponsorship.toFixed(2)}`;
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Edit profile button
    const editBtn = document.getElementById('edit-profile-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => this.editProfile());
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }

    // Navigate to upload
    const uploadBtn = document.getElementById('upload-btn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        window.location.href = '/upload.html';
      });
    }
  }

  /**
   * Edit profile
   */
  editProfile() {
    console.log('Opening profile editor...');
    Toast.success('Profile editing coming soon!');
  }

  /**
   * Logout
   */
  logout() {
    if (confirm('Are you sure you want to logout?')) {
      session.logout();
      window.location.href = '/login.html';
    }
  }

  /**
   * Format number with K/M suffix
   */
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  /**
   * Redirect to login
   */
  redirectToLogin() {
    window.location.href = '/login.html';
  }
}

// Initialize dashboard when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
  });
} else {
  window.dashboardManager = new DashboardManager();
}

console.log('✅ Dashboard Manager Loaded');
