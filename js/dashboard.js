/**
 * GorkhaReels - Creator Dashboard (FIXED)
 * 
 * FIXES APPLIED:
 * ✅ FIX #15: Proper error handling for missing creator profile
 * ✅ COUNT VIDEOS DYNAMICALLY: Total videos counted from REELS collection (Option A)
 * ✅ DISPLAY USER VIDEOS: Show uploaded videos in dashboard
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

  // FIX #15: Better error handling and profile validation
  async loadCreatorData() {
    try {
      this.creatorData = await db.get(APPWRITE_CONFIG.COLLECTIONS.CREATORS, this.user.$id);
      console.log('✅ Creator profile loaded');
    } catch (error) {
      console.warn('Creator profile not found, creating new one:', error.message);
      
      // Profile doesn't exist - create a default one
      try {
        this.creatorData = {
          userId: this.user.$id,
          name: this.user.name || 'Unknown Creator',
          email: this.user.email,
          bio: '',
          profilePic: '',
          followers: 0,
          totalViews: 0,
          totalReels: 0,
          totalEarnings: 0,
          username: '',
          isVerified: false,
          isActive: true,
          createdAt: new Date().toISOString()
        };

        // Try to save it to database
        await db.create(APPWRITE_CONFIG.COLLECTIONS.CREATORS, this.creatorData, this.user.$id);
        console.log('✅ New creator profile created');
      } catch (createErr) {
        console.error('Failed to create profile:', createErr);
        // Fall back to empty profile - user can complete setup later
        this.creatorData = {
          userId: this.user.$id,
          name: this.user.name || 'Creator',
          email: this.user.email,
          bio: 'Complete your profile',
          profilePic: '',
          followers: 0,
          totalViews: 0,
          totalReels: 0,
          totalEarnings: 0
        };
        Toast.info('📝 Please complete your profile');
      }
    }
    
    this.displayProfile();
  }

  displayProfile() {
    const d = this.creatorData;
    this.setText('creator-name', d.name || 'Unknown Creator');
    this.setText('creator-bio', d.bio || 'Complete your profile');
    this.setText('followers-count', d.followers || 0);
    this.setText('total-views', this.formatNumber(d.totalViews || 0));
    
    // FIXED: Total reels will be set dynamically after loading videos
    // this.setText('total-reels', d.totalReels || 0);

    const avatar = document.getElementById('creator-avatar');
    if (avatar) avatar.src = d.profilePic || 'assets/logo.png';

    // Earnings (default 0 for now)
    this.setText('total-earnings', '₹ 0.00');
    this.setText('ad-revenue', '₹ 0.00');
    this.setText('tips-earnings', '₹ 0.00');
    this.setText('sponsor-earnings', '₹ 0.00');
    this.setText('total-views-perf', this.formatNumber(d.totalViews || 0));
  }

  async loadMyReels() {
    try {
      const response = await db.list(APPWRITE_CONFIG.COLLECTIONS.REELS, [
        Query.equal('creatorId', this.user.$id),
        Query.orderDesc('uploadedAt'),
        Query.limit(50)
      ]);
      this.myReels = response.documents;
      
      // FIXED OPTION A: Count videos dynamically
      const totalVideos = this.myReels.length;
      this.setText('total-reels', totalVideos);
      
      console.log(`✅ Loaded ${this.myReels.length} reels`);
      this.displayMyReels();
    } catch (error) {
      console.error('Error loading reels:', error);
      this.setText('total-reels', 0);
      this.displayMyReels(); // Display empty state
    }
  }

  displayMyReels() {
    const container = document.getElementById('my-reels-container');
    if (!container) return;

    if (this.myReels.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:var(--text-secondary);">
          <p>No videos uploaded yet</p>
          <a href="./upload.html" class="btn btn-primary" style="max-width:300px;margin-top:20px;display:inline-block;">📹 Upload Your First Video</a>
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
          <img src="${reel.thumbnail || 'assets/logo.png'}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;" alt="${escapeHtml(reel.title)}">
          <div style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.7);color:white;padding:4px 8px;border-radius:4px;font-size:12px;">👁️ ${reel.views || 0}</div>
        </div>
        <div style="padding:12px;">
          <p style="font-size:12px;font-weight:600;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(reel.title)}</p>
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
      this.openEditProfile();
    });
    document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
  }

  // ============== EDIT PROFILE FEATURE ==============
  openEditProfile() {
    const d = this.creatorData;

    const modal = document.createElement('div');
    modal.id = 'edit-profile-modal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.7); z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
    `;

    modal.innerHTML = `
      <div style="background: var(--dark-card, #1a1a1a); border-radius: 16px; width: 100%; max-width: 400px; max-height: 85vh; overflow-y: auto;">
        <div style="padding: 20px; border-bottom: 1px solid var(--border-color, #333); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="color: var(--text-primary, #fff); margin: 0; font-size: 18px;">✏️ Edit Profile</h3>
          <button id="close-edit-profile" style="background: none; border: none; color: var(--text-primary, #fff); font-size: 24px; cursor: pointer;">✕</button>
        </div>
        <div style="padding: 20px;">
          <div style="margin-bottom: 16px;">
            <label style="display: block; color: var(--text-secondary, #888); font-size: 13px; margin-bottom: 6px;">Name</label>
            <input id="edit-name" type="text" value="${escapeHtml(d.name || '')}" style="width: 100%; background: var(--dark-bg, #000); border: 1px solid var(--border-color, #333); border-radius: 8px; padding: 12px; color: var(--text-primary, #fff); font-size: 14px; box-sizing: border-box;">
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: block; color: var(--text-secondary, #888); font-size: 13px; margin-bottom: 6px;">Bio</label>
            <textarea id="edit-bio" rows="3" style="width: 100%; background: var(--dark-bg, #000); border: 1px solid var(--border-color, #333); border-radius: 8px; padding: 12px; color: var(--text-primary, #fff); font-size: 14px; box-sizing: border-box; resize: vertical;">${escapeHtml(d.bio || '')}</textarea>
          </div>
          <div style="margin-bottom: 20px;">
            <label style="display: block; color: var(--text-secondary, #888); font-size: 13px; margin-bottom: 6px;">Profile Picture URL</label>
            <input id="edit-profilePic" type="text" value="${escapeHtml(d.profilePic || '')}" placeholder="https://..." style="width: 100%; background: var(--dark-bg, #000); border: 1px solid var(--border-color, #333); border-radius: 8px; padding: 12px; color: var(--text-primary, #fff); font-size: 14px; box-sizing: border-box;">
          </div>
          <button id="save-profile" style="width: 100%; background: var(--primary-red, #ff3b30); border: none; border-radius: 8px; padding: 14px; color: white; font-weight: 600; font-size: 15px; cursor: pointer;">💾 Save Changes</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('close-edit-profile').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    document.getElementById('save-profile').addEventListener('click', () => this.saveProfile());
  }

  async saveProfile() {
    const name = document.getElementById('edit-name')?.value?.trim();
    const bio = document.getElementById('edit-bio')?.value?.trim();
    const profilePic = document.getElementById('edit-profilePic')?.value?.trim();

    if (!name || name.length < 2) {
      Toast.error('Name must be at least 2 characters');
      return;
    }

    const saveBtn = document.getElementById('save-profile');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ Saving...';
    }

    try {
      await db.update(APPWRITE_CONFIG.COLLECTIONS.CREATORS, this.user.$id, {
        name: name,
        bio: bio || '',
        profilePic: profilePic || ''
      });

      // Update local data
      this.creatorData.name = name;
      this.creatorData.bio = bio;
      this.creatorData.profilePic = profilePic;

      // Refresh display
      this.displayProfile();

      Toast.success('✅ Profile updated!');
      document.getElementById('edit-profile-modal')?.remove();
    } catch (error) {
      console.error('Save profile failed:', error);
      Toast.error('Failed to save profile');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save Changes';
      }
    }
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

console.log('✅ Dashboard Manager Loaded (with dynamic video counting - Option A)');
