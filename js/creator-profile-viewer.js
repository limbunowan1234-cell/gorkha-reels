/**
 * GorkhaReels - Creator Profile Viewer (UPDATED with Tagged Videos)
 * 
 * Displays public creator profile with:
 * ✅ Real-time view aggregation from REELS
 * ✅ Video count from REELS collection
 * ✅ Creator followers, bio, profile pic
 * ✅ Video grid with view counts
 * ✅ Videos I'm tagged in section
 * ✅ Proper error handling
 */

class CreatorProfileViewer {
  constructor() {
    this.creator = null;
    this.reels = [];
    this.taggedReels = [];
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
    await this.loadTaggedReels(creatorId);
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
      console.log(`✅ Loaded ${this.reels.length} creator reels`);
    } catch (error) {
      console.error('Error loading reels:', error);
      this.reels = [];
    }
  }

  async loadTaggedReels(creatorId) {
    try {
      const response = await db.list(APPWRITE_CONFIG.COLLECTIONS.REELS, [
        Query.equal('isDeleted', false),
        Query.orderDesc('uploadedAt'),
        Query.limit(100)
      ]);
      
      // Filter for reels where this creator is tagged
      this.taggedReels = response.documents.filter(reel => {
        if (!reel.taggedCreators) return false;
        try {
          const tags = typeof reel.taggedCreators === 'string' 
            ? JSON.parse(reel.taggedCreators) 
            : reel.taggedCreators;
          return tags.some(tag => tag.creatorId === creatorId);
        } catch {
          return false;
        }
      });
      
      console.log(`✅ Loaded ${this.taggedReels.length} reels where creator is tagged`);
    } catch (error) {
      console.error('Error loading tagged reels:', error);
      this.taggedReels = [];
    }
  }

  renderProfile() {
    if (!this.creator) return;

    const d = this.creator;
    const totalReels = this.reels.length;
    const totalViews = this.reels.reduce((sum, r) => sum + (r.views || 0), 0);
    const totalFollowers = d.followers || 0;

    const html = `
      <div class="profile-header">
        <img class="profile-pic" src="${d.profilePic || '/logo-suite/primary/logo-khukuri-512x512.png'}" alt="${escapeHtml(d.name)}" onerror="this.src='/logo-suite/primary/logo-khukuri-512x512.png'">
        <div class="profile-name">${escapeHtml(d.name || 'Creator')}</div>
        <div class="profile-bio">${escapeHtml(d.bio || 'No bio yet')}</div>
      </div>

      <div class="profile-stats">
        <div class="stat">
          <div class="stat-num">${totalReels}</div>
          <div class="stat-label">Videos</div>
        </div>
        <div class="stat">
          <div class="stat-num">${this.formatNumber(totalFollowers)}</div>
          <div class="stat-label">Followers</div>
        </div>
        <div class="stat">
          <div class="stat-num">${this.formatNumber(totalViews)}</div>
          <div class="stat-label">Views</div>
        </div>
      </div>

      <div class="profile-actions">
        <button class="action-btn btn-follow" onclick="alert('Follow feature coming soon!')">Follow</button>
        <button class="action-btn btn-message" onclick="alert('Message feature coming soon!')">Message</button>
      </div>

      <div class="videos-section">
        <div class="section-title">📹 Videos</div>
        <div id="creator-reels-grid" class="videos-grid">
          ${this.reels.length === 0 
            ? '<div class="empty-state" style="grid-column:1/-1;">No videos yet</div>'
            : this.reels.map(reel => this.renderReelCard(reel)).join('')
          }
        </div>
      </div>

      ${this.taggedReels.length > 0 ? `
        <div class="videos-section">
          <div class="section-title">🏷️ Videos Tagged With Me</div>
          <div id="tagged-reels-grid" class="videos-grid">
            ${this.taggedReels.map(reel => this.renderTaggedReelCard(reel)).join('')}
          </div>
        </div>
      ` : ''}
    `;

    document.getElementById('creator-profile-container').innerHTML = html;

    console.log(`📊 Profile: ${d.name} | Videos: ${totalReels} | Views: ${totalViews} | Tagged in: ${this.taggedReels.length}`);
  }

  renderReelCard(reel) {
    return `
      <div class="video-thumb" onclick="window.location.href='./video-modal.html?id=${reel.$id}'">
        <video
          src="${reel.videoUrl}#t=0.5"
          style="width:100%;height:100%;object-fit:cover;"
          preload="metadata"
          muted
          playsinline
        ></video>
        <div class="video-views">👁️ ${this.formatNumber(reel.views || 0)}</div>
      </div>
    `;
  }

  renderTaggedReelCard(reel) {
    return `
      <div class="video-thumb" onclick="window.location.href='./video-modal.html?id=${reel.$id}'">
        <video
          src="${reel.videoUrl}#t=0.5"
          style="width:100%;height:100%;object-fit:cover;"
          preload="metadata"
          muted
          playsinline
        ></video>
        <div class="video-views">👁️ ${this.formatNumber(reel.views || 0)}</div>
      </div>
    `;
  }

  showError(message) {
    document.getElementById('creator-profile-container').innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:#dc2626;">
        <div style="font-size:40px;margin-bottom:12px;">❌</div>
        <p>${escapeHtml(message)}</p>
        <a href="./index.html" style="display:inline-block;margin-top:16px;text-decoration:none;padding:10px 24px;border-radius:8px;background:var(--primary-red);color:#fff;font-weight:700;">Back to Home</a>
      </div>
    `;
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

console.log('✅ Creator Profile Viewer Loaded (with tagged videos + tagging system)');
