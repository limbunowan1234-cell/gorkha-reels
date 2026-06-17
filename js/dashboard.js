/**
 * GorkhaReels - Creator Dashboard (Appwrite Web SDK)
 */

class DashboardManager {
  constructor() {
    this.user = null;
    this.creatorData = null;
    this.myReels = [];
    this.init();
  }

  async init() {
    await session.refresh();
    if (!session.isLoggedIn()) {
      window.location.href = './login.html';
      return;
    }
    this.user = session.getUser();
    await this.loadCreatorData();
    await this.loadMyReels();
    this.setupEventListeners();
  }

  async loadCreatorData() {
    try {
      this.creatorData = await db.get(APPWRITE_CONFIG.COLLECTIONS.CREATORS, this.user.$id);
    } catch (error) {
      // Profile doc may not exist - use account data as fallback
      console.warn('No creator profile, using account data');
      this.creatorData = {
        name: this.user.name,
        email: this.user.email,
        bio: '',
        profilePic: '',
        followers: 0,
        totalViews: 0,
        totalReels: 0
      };
    }
    this.displayProfile();
  }

  displayProfile() {
    const d = this.creatorData;
    this.setText('creator-name', d.name);
    this.setText('creator-bio', d.bio || 'No bio yet');
    this.setText('followers-count', d.followers || 0);
    this.setText('total-views', this.formatNumber(d.totalViews || 0));
    this.setText('total-reels', d.totalReels || 0);

    const avatar = document.getElementById('creator-avatar');
    if (avatar) avatar.src = d.profilePic || 'assets/logo.png';

    // Earnings (default 0 for now)
    this.setText('total-earnings', '₹ 0.00');
    this.setText('ad-revenue', '₹ 0.00');
    this.setText('tips-earnings', '₹ 0.00');
    this.setText('sponsor-earnings', '₹ 0.00');
  }

  async loadMyReels() {
    try {
      const response = await db.list(APPWRITE_CONFIG.COLLECTIONS.REELS, [
        Query.equal('creatorId', this.user.$id),
        Query.orderDesc('uploadedAt'),
        Query.limit(50)
      ]);
      this.myReels = response.documents;
      this.displayMyReels();
    } catch (error) {
      console.error('Error loading reels:', error);
      this.displayMyReels();
    }
  }

  displayMyReels() {
    const container = document.getElementById('my-reels-container');
    if (!container) return;

    if (this.myReels.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:var(--text-secondary);">
          <p>No videos uploaded yet</p>
          <a href="./upload.html" class="btn btn-primary" style="max-width:300px;margin-top:20px;display:inline-block;">Upload Your First Video</a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        ${this.myReels.map(r => this.renderReelCard(r)).join('')}
      </div>
    `;
  }

  renderReelCard(reel) {
    const date = new Date(reel.uploadedAt).toLocaleDateString();
    return `
      <div style="background:var(--dark-card);border-radius:8px;overflow:hidden;border:1px solid var(--border-color);cursor:pointer;" onclick="window.location.href='./index.html?reel=${reel.$id}'">
        <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;background:var(--dark-bg);">
          <img src="${reel.thumbnail || 'assets/logo.png'}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;" alt="${reel.title}">
          <div style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.7);color:white;padding:4px 8px;border-radius:4px;font-size:12px;">${reel.views || 0} views</div>
        </div>
        <div style="padding:12px;">
          <p style="font-size:12px;font-weight:600;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${reel.title}</p>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-secondary);">
            <span>❤️ ${reel.likes || 0}</span>
            <span>💬 ${reel.comments || 0}</span>
            <span>${date}</span>
          </div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    document.getElementById('upload-btn')?.addEventListener('click', () => {
      window.location.href = './upload.html';
    });
    document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
      Toast.success('Profile editing coming soon!');
    });
    document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
  }

  async logout() {
    if (confirm('Are you sure you want to logout?')) {
      await session.logout();
      window.location.href = './login.html';
    }
  }

  setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
  });
} else {
  window.dashboardManager = new DashboardManager();
}

console.log('✅ Dashboard Manager Loaded');
