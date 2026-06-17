/**
 * GorkhaReels - Feed Logic (Appwrite Web SDK)
 * Infinite scroll feed with video playback and interactions
 */

class FeedManager {
  constructor() {
    this.reels = [];
    this.currentIndex = 0;
    this.isLoading = false;
    this.hasMore = true;
    this.pageSize = 10;
    this.currentVideo = null;
    this.likedReels = new Set();

    this.init();
  }

  async init() {
    console.log('Initializing Feed...');

    // Check session with Appwrite (async)
    await session.refresh();

    if (!session.isLoggedIn()) {
      this.showLoginPrompt();
      return;
    }

    await this.loadReels();
    this.setupEventListeners();

    if (this.reels.length === 0) {
      this.showEmptyState();
    } else {
      this.displayCurrentVideo();
    }
  }

  async loadReels() {
    if (this.isLoading || !this.hasMore) return;

    this.isLoading = true;
    try {
      const queries = [
        Query.equal('isDeleted', false),
        Query.orderDesc('uploadedAt'),
        Query.limit(this.pageSize),
        Query.offset(this.reels.length)
      ];

      const response = await db.list(APPWRITE_CONFIG.COLLECTIONS.REELS, queries);

      this.reels = [...this.reels, ...response.documents];
      this.hasMore = response.documents.length === this.pageSize;

      console.log(`✅ Loaded ${response.documents.length} reels`);
    } catch (error) {
      console.error('Error loading reels:', error);
      // Don't toast on empty - just show empty state
    } finally {
      this.isLoading = false;
    }
  }

  setupEventListeners() {
    document.addEventListener('wheel', (e) => this.handleScroll(e), { passive: true });
    document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
    document.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => this.handleNavClick(e));
    });
  }

  handleScroll(e) {
    if (this._scrollLock) return;
    this._scrollLock = true;
    setTimeout(() => { this._scrollLock = false; }, 600);

    if (e.deltaY > 0) this.nextVideo();
    else if (e.deltaY < 0) this.previousVideo();
  }

  touchStartY = 0;
  handleTouchStart(e) {
    this.touchStartY = e.changedTouches[0].screenY;
  }
  handleTouchEnd(e) {
    const diff = this.touchStartY - e.changedTouches[0].screenY;
    if (Math.abs(diff) > 50) {
      if (diff > 0) this.nextVideo();
      else this.previousVideo();
    }
  }

  nextVideo() {
    if (this.currentIndex < this.reels.length - 1) {
      this.currentIndex++;
      this.displayCurrentVideo();
      if (this.currentIndex >= this.reels.length - 3) this.loadReels();
    }
  }

  previousVideo() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.displayCurrentVideo();
    }
  }

  displayCurrentVideo() {
    const reel = this.reels[this.currentIndex];
    if (!reel) return;
    this.currentVideo = reel;

    const container = document.getElementById('feed-container');
    if (!container) return;

    container.innerHTML = this.renderVideoCard(reel);
    this.setupCardEventListeners();

    const video = document.querySelector('.video-player');
    if (video) {
      video.play().catch(e => console.log('Autoplay blocked:', e));
    }

    // Increment view count (fire and forget)
    this.incrementViews(reel);
  }

  async incrementViews(reel) {
    try {
      await db.update(APPWRITE_CONFIG.COLLECTIONS.REELS, reel.$id, {
        views: (reel.views || 0) + 1
      });
    } catch (e) {
      // Non-critical
    }
  }

  renderVideoCard(reel) {
    const isLiked = this.likedReels.has(reel.$id);
    return `
      <div class="video-card">
        <video class="video-player" src="${reel.videoUrl}" loop playsinline preload="metadata"></video>
        <div class="video-overlay">
          <span class="video-category">${reel.category || 'General'}</span>
          <h2 class="video-title">${reel.title}</h2>
          <div class="video-meta">
            <span>${reel.views || 0} views</span>
            <span>•</span>
            <span>${reel.language || 'Nepali'}</span>
          </div>
          <div class="creator-info">
            <img src="${reel.creatorPic || 'assets/logo.png'}" alt="Creator" class="creator-avatar">
            <div class="creator-details">
              <div class="creator-name">${reel.creatorName || 'Creator'}</div>
            </div>
            <button class="follow-btn" data-creator-id="${reel.creatorId}">Follow</button>
          </div>
          <p class="video-description">${reel.description || ''}</p>
          <div class="video-hashtags">${this.formatHashtags(reel.hashtags)}</div>
        </div>
        <div class="action-buttons">
          <button class="action-btn like-btn ${isLiked ? 'liked' : ''}" data-reel-id="${reel.$id}" title="Like">
            ❤️<span class="action-count">${reel.likes || 0}</span>
          </button>
          <button class="action-btn comment-btn" data-reel-id="${reel.$id}" title="Comment">
            💬<span class="action-count">${reel.comments || 0}</span>
          </button>
          <button class="action-btn share-btn" data-reel-id="${reel.$id}" title="Share">
            ↗️<span class="action-count">${reel.shares || 0}</span>
          </button>
        </div>
      </div>
    `;
  }

  formatHashtags(hashtags) {
    if (!hashtags) return '';
    return hashtags.split(' ').filter(t => t.startsWith('#')).slice(0, 3).join(' ');
  }

  setupCardEventListeners() {
    document.querySelector('.like-btn')?.addEventListener('click', (e) => {
      this.toggleLike(e.currentTarget.dataset.reelId);
    });
    document.querySelector('.comment-btn')?.addEventListener('click', () => {
      Toast.success('Comments coming soon!');
    });
    document.querySelector('.share-btn')?.addEventListener('click', (e) => {
      this.shareVideo(e.currentTarget.dataset.reelId);
    });
    document.querySelector('.follow-btn')?.addEventListener('click', (e) => {
      this.toggleFollow(e.currentTarget.dataset.creatorId);
    });

    const video = document.querySelector('.video-player');
    if (video) {
      video.addEventListener('click', () => {
        if (video.paused) video.play();
        else video.pause();
      });
    }
  }

  async toggleLike(reelId) {
    const likeButton = document.querySelector('.like-btn');
    const isLiked = this.likedReels.has(reelId);

    if (isLiked) {
      this.likedReels.delete(reelId);
      likeButton.classList.remove('liked');
      this.currentVideo.likes = Math.max(0, (this.currentVideo.likes || 1) - 1);
    } else {
      this.likedReels.add(reelId);
      likeButton.classList.add('liked');
      this.currentVideo.likes = (this.currentVideo.likes || 0) + 1;
    }
    likeButton.querySelector('.action-count').textContent = this.currentVideo.likes;

    try {
      await db.update(APPWRITE_CONFIG.COLLECTIONS.REELS, reelId, {
        likes: this.currentVideo.likes
      });
    } catch (e) {
      console.error('Like update failed:', e);
    }
  }

  async toggleFollow(creatorId) {
    const btn = document.querySelector('.follow-btn');
    const isFollowing = btn.classList.contains('following');
    if (isFollowing) {
      btn.classList.remove('following');
      btn.textContent = 'Follow';
    } else {
      btn.classList.add('following');
      btn.textContent = 'Following';
      Toast.success('Followed!');
    }
  }

  shareVideo(reelId) {
    const url = `${window.location.origin}${window.location.pathname}?reel=${reelId}`;
    if (navigator.share) {
      navigator.share({
        title: this.currentVideo.title,
        text: this.currentVideo.description,
        url
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      Toast.success('Link copied!');
    }
  }

  handleNavClick(e) {
    const nav = e.currentTarget.dataset.nav;
    switch (nav) {
      case 'home': window.location.href = './index.html'; break;
      case 'create': window.location.href = './upload.html'; break;
      case 'profile': window.location.href = './creator-dashboard.html'; break;
      case 'trending': this.loadTrending(); break;
    }
  }

  async loadTrending() {
    try {
      const response = await db.list(APPWRITE_CONFIG.COLLECTIONS.REELS, [
        Query.equal('isDeleted', false),
        Query.orderDesc('views'),
        Query.limit(20)
      ]);
      this.reels = response.documents;
      this.currentIndex = 0;
      if (this.reels.length) this.displayCurrentVideo();
      else this.showEmptyState();
      Toast.success('Showing trending 🔥');
    } catch (e) {
      Toast.error('Failed to load trending');
    }
  }

  showEmptyState() {
    const container = document.getElementById('feed-container');
    if (container) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:80vh;">
          <img src="assets/logo.png" alt="GorkhaReels" style="height:60px;margin-bottom:20px;opacity:0.7;">
          <h2 style="color:var(--text-primary);margin-bottom:12px;">No videos yet</h2>
          <p style="color:var(--text-secondary);margin-bottom:30px;max-width:300px;">Be the first to share a video with the Gorkha community!</p>
          <button class="btn btn-primary" onclick="window.location.href='./upload.html'" style="max-width:250px;">
            📹 Upload First Video
          </button>
        </div>
      `;
    }
  }

  showLoginPrompt() {
    const container = document.getElementById('feed-container');
    if (container) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:80vh;">
          <img src="assets/logo.png" alt="GorkhaReels" style="height:60px;margin-bottom:20px;">
          <h2 style="color:var(--primary-red);margin-bottom:20px;font-size:24px;">Welcome to GorkhaReels</h2>
          <p style="color:var(--text-secondary);margin-bottom:30px;font-size:14px;max-width:300px;">Sign in to watch, upload, and share videos with the Gorkha community</p>
          <button class="btn btn-primary" onclick="window.location.href='./login.html'" style="max-width:250px;margin-bottom:12px;">Sign In</button>
          <button class="btn btn-secondary" onclick="window.location.href='./login.html'" style="max-width:250px;">Create Account</button>
        </div>
      `;
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.feedManager = new FeedManager();
  });
} else {
  window.feedManager = new FeedManager();
}

console.log('✅ Feed Manager Loaded');
