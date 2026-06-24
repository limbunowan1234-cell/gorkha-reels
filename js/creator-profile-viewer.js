/**
 * GorkhaReels - Creator Profile Viewer
 * 
 * Displays public creator profile with:
 * ✅ Real-time view aggregation from REELS
 * ✅ Video count from REELS collection
 * ✅ Creator followers, bio, profile pic
 * ✅ Video grid with view counts
 * ✅ Proper error handling
 */

class CreatorProfileViewer {
  constructor() {
    this.creator = null;
    this.reels = [];
    this.init();
  }

  async init() {
    const creatorId = new URLSearchParams(location.search).get('creatorId') || new URLSearchParams(location.search).get('id');
    if (!creatorId) {
      this.showError('Creator ID not found');
      return;
    }
    
    await this.loadCreator(creatorId);
    await this.loadCreatorReels(creatorId);
    this.renderProfile();
  }

  async loadCreator(creatorId) {
    try {
      this.creator = await db.get(APPWRITE_CONFIG.COLLECTIONS.CREATORS, creatorId);
      console.log('✅ Creator profile loaded:', this.creator.name);
    } catch (error) {
      console.error('Error loading creator:', error);
      this.showError('Creator profile not found');
    }
  }

  async loadCreatorReels(creatorId) {
    try {
      const response = await db.list(APPWRITE_CONFIG.COLLECTIONS.REELS, [
        Query.equal('creatorId', creatorId),
        Query.equal('isDeleted', false),
        Query.orderDesc('uploadedAt'),
        Query.limit(50)
      ]);
      this.reels = response.documents;
      console.log(`✅ Loaded ${this.reels.length} reels`);
    } catch (error) {
      console.error('Error loading reels:', error);
      this.reels = [];
    }
  }

  renderProfile() {
    if (!this.creator) return;

    const d = this.creator;
    const totalReels = this.reels.length;
    const totalViews = this.reels.reduce((sum, r) => sum + (r.views || 0), 0);
    const totalFollowers = d.followers || 0;

    // Update creator info
    this.setTextById('creator-name', d.name || 'Creator');
    this.setTextById('creator-bio', d.bio || 'No bio yet');
    this.setTextById('videos-count', totalReels);
    this.setTextById('views-count', this.formatNumber(totalViews));
    this.setTextById('followers-count', this.formatNumber(totalFollowers));

    // Update profile picture
    const avatar = document.getElementById('creator-avatar');
    if (avatar) {
      avatar.src = d.profilePic || '/logo-suite/primary/logo-khukuri-512x512.png';
      avatar.onerror = function() { this.src = '/logo-suite/primary/logo-khukuri-512x512.png'; };
    }

    // Render reels grid
    this.renderReelsGrid();

    console.log(`📊 Profile: ${d.name} | Videos: ${totalReels} | Views: ${totalViews}`);
  }

  renderReelsGrid() {
    const container = document.getElementById('creator-reels-grid');
    if (!container) return;

    if (this.reels.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:var(--text-secondary);grid-column:1/-1;">
          <div style="font-size:40px;margin-bottom:12px;">🎬</div>
          <p>No videos yet</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.reels.map(reel => `
      <div style="position:relative;aspect-ratio:9/16;border-radius:8px;overflow:hidden;background:var(--dark-secondary);cursor:pointer;transition:transform 0.2s;" onclick="window.location.href='./index.html?reel=${reel.$id}'">
        <video
          src="${reel.videoUrl}#t=0.5"
          style="width:100%;height:100%;object-fit:cover;"
          preload="metadata"
          muted
          playsinline
        ></video>
        <div style="position:absolute;bottom:0;left:0;right:0;padding:8px;background:linear-gradient(transparent,rgba(0,0,0,0.8));">
          <div style="color:#fff;font-size:12px;font-weight:600;">
            👁️ ${this.formatNumber(reel.views || 0)}
          </div>
          <div style="color:#fff;font-size:13px;font-weight:600;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${escapeHtml(reel.title || 'Untitled')}
          </div>
        </div>
      </div>
    `).join('');
  }

  showError(message) {
    const container = document.getElementById('creator-profile-container');
    if (container) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:#dc2626;">
          <div style="font-size:40px;margin-bottom:12px;">❌</div>
          <p>${escapeHtml(message)}</p>
          <a href="./index.html" style="display:inline-block;margin-top:16px;text-decoration:none;padding:10px 24px;border-radius:8px;background:var(--primary-red);color:#fff;font-weight:700;">Back to Home</a>
        </div>
      `;
    }
  }

  setTextById(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.creatorProfileViewer = new CreatorProfileViewer();
  });
} else {
  window.creatorProfileViewer = new CreatorProfileViewer();
}

console.log('✅ Creator Profile Viewer Loaded (with view aggregation)');
