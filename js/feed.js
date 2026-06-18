/**
 * GorkhaReels - Feed Logic (FIXED)
 * Likes now work with permissions, no failing reel updates
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
    this.isFullscreen = false;
    this.viewTimers = {};
    this.lastTimestamp = null;
    this.mode = 'recommended';
    this.creatorsCache = {};
    this.init();
  }

  async init() {
    console.log('Initializing Feed...');
    await session.refresh();
    if (!session.isLoggedIn()) {
      this.showLoginPrompt();
      return;
    }
    await this.loadRecommended();
    this.setupEventListeners();
    if (this.reels.length === 0) {
      this.showEmptyState();
    } else {
      this.displayCurrentVideo();
    }
  }

  async loadRecommended() {
    if (this.isLoading) return;
    this.isLoading = true;
    this.mode = 'recommended';
    try {
      let preferredCategories = [];
      const userId = session.getUserId();
      const likes = await db.list(APPWRITE_CONFIG.COLLECTIONS.LIKES, [
        Query.equal('creatorId', userId),
        Query.orderDesc('createdAt'),
        Query.limit(10)
      ]);
      if (likes.documents.length > 0) {
        const likedReelIds = likes.documents.map(l => l.reelId);
        for (const reelId of likedReelIds.slice(0, 5)) {
          try {
            const reel = await db.get(APPWRITE_CONFIG.COLLECTIONS.REELS, reelId);
            if (reel.category) preferredCategories.push(reel.category);
          } catch (e) {}
        }
      }
      let queries;
      if (preferredCategories.length > 0) {
        const counts = {};
        preferredCategories.forEach(c => counts[c] = (counts[c] || 0) + 1);
        const topCategory = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
        queries = [
          Query.equal('isDeleted', false),
          Query.equal('category', topCategory),
          Query.orderDesc('likes'),
          Query.limit(20)
        ];
      } else {
        queries = [
          Query.equal('isDeleted', false),
          Query.orderDesc('uploadedAt'),
          Query.limit(20)
        ];
      }
      const response = await db.list(APPWRITE_CONFIG.COLLECTIONS.REELS, queries);
      this.reels = response.documents;
      this.hasMore = false;
      await this.loadUserLikes();
      await this.loadCreatorCache(this.reels);
    } catch (error) {
      console.error('Error loading recommended:', error);
      await this.loadFallbackReels();
    } finally {
      this.isLoading = false;
    }
  }

  async loadFallbackReels() {
    try {
      const response = await db.list(APPWRITE_CONFIG.COLLECTIONS.REELS, [
        Query.equal('isDeleted', false),
        Query.orderDesc('uploadedAt'),
        Query.limit(20)
      ]);
      this.reels = response.documents;
      await this.loadUserLikes();
    } catch (error) {
      console.error('Fallback failed:', error);
    }
  }

  async loadReels() {
    if (this.isLoading ||!this.hasMore) return;
    this.isLoading = true;
    try {
      const queries = [
        Query.equal('isDeleted', false),
        Query.orderDesc('uploadedAt'),
        Query.limit(this.pageSize)
      ];
      if (this.lastTimestamp) {
        queries.push(Query.lessThan('uploadedAt', this.lastTimestamp));
      }
      const response = await db.list(APPWRITE_CONFIG.COLLECTIONS.REELS, queries);
      this.reels = [...this.reels,...response.documents];
      this.hasMore = response.documents.length === this.pageSize;
      if (response.documents.length > 0) {
        this.lastTimestamp = response.documents[response.documents.length - 1].uploadedAt;
      }
      await this.loadUserLikes();
    } catch (error) {
      console.error('Error loading reels:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async loadCreatorCache(reels) {
    const uncachedIds = [...new Set(reels.map(r => r.creatorId).filter(id => id &&!this.creatorsCache[id]))];
    for (const creatorId of uncachedIds) {
      try {
        const creator = await db.get(APPWRITE_CONFIG.COLLECTIONS.CREATORS, creatorId);
        this.creatorsCache[creatorId] = creator;
      } catch (e) {
        this.creatorsCache[creatorId] = { name: 'GorkhaReels Creator', profilePic: '' };
      }
    }
  }

  getCreator(reel) {
    if (reel.creatorName) {
      return { name: reel.creatorName, profilePic: reel.creatorProfilePic || '' };
    }
    return this.creatorsCache[reel.creatorId] || { name: 'GorkhaReels Creator', profilePic: '' };
  }

  async loadUserLikes() {
    try {
      if (!session.isLoggedIn()) return;
      const userId = session.getUserId();
      const response = await db.list(APPWRITE_CONFIG.COLLECTIONS.LIKES, [
        Query.equal('creatorId', userId),
        Query.limit(1000)
      ]);
      this.likedReels = new Set(response.documents.map(like => like.reelId));
    } catch (error) {
      console.warn('Could not load likes:', error);
    }
  }

  setupEventListeners() {
    document.addEventListener('wheel', (e) => this.handleScroll(e), { passive: true });
    document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
    document.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
    document.addEventListener('keydown', (e) => this.handleKeypress(e));
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => this.handleNavClick(e));
    });
  }

  handleScroll(e) {
    if (this._scrollLock || this.isFullscreen) return;
    this._scrollLock = true;
    setTimeout(() => { this._scrollLock = false; }, 600);
    if (e.deltaY > 0) this.nextVideo();
    else if (e.deltaY < 0) this.previousVideo();
  }

  touchStartY = 0;
  handleTouchStart(e) { this.touchStartY = e.changedTouches[0].screenY; }
  handleTouchEnd(e) {
    if (this.isFullscreen) return;
    const diff = this.touchStartY - e.changedTouches[0].screenY;
    if (Math.abs(diff) > 120) {
      if (diff > 0) this.nextVideo(); else this.previousVideo();
    }
  }

  handleKeypress(e) {
    if (e.key === 'Escape' && this.isFullscreen) this.exitFullscreen();
    else if (e.key === 'ArrowUp' && this.isFullscreen) this.previousVideo();
    else if (e.key === 'ArrowDown' && this.isFullscreen) this.nextVideo();
  }

  nextVideo() {
    if (this.currentIndex < this.reels.length - 1) {
      this.currentIndex++;
      this.displayCurrentVideo();
      if (this.currentIndex >= this.reels.length - 3) this.loadReels();
    } else if (this.hasMore) {
      this.loadReels().then(() => {
        if (this.reels.length > this.currentIndex + 1) {
          this.currentIndex++;
          this.displayCurrentVideo();
        }
      });
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
    if (this.isFullscreen) this.displayFullscreenVideo(reel);
    else this.displayNormalVideo(reel);
    const video = document.querySelector('.video-player');
    if (video) video.play().catch(() => {});
    this.incrementViews(reel);
  }

  displayNormalVideo(reel) {
    const container = document.getElementById('feed-container');
    if (!container) return;
    container.innerHTML = this.renderVideoCard(reel);
    this.setupCardEventListeners();
  }

  displayFullscreenVideo(reel) {
    const container = document.getElementById('feed-container');
    if (!container) return;
    container.innerHTML = `
      <div class="fullscreen-video-container">
        <video class="video-player fullscreen-video" src="${reel.videoUrl}" playsinline autoplay muted loop></video>
        <div class="fullscreen-header"><img src="assets/logo.png" alt="GorkhaReels" class="fullscreen-logo"></div>
        <div class="fullscreen-actions">
          <button class="fullscreen-action-btn like-btn ${this.likedReels.has(reel.$id)? 'liked' : ''}" data-reel-id="${reel.$id}"><div class="action-icon">❤️</div><div class="action-count">${reel.likes || 0}</div></button>
          <button class="fullscreen-action-btn comment-btn" data-reel-id="${reel.$id}"><div class="action-icon">💬</div><div class="action-count">${reel.comments || 0}</div></button>
          <button class="fullscreen-action-btn share-btn" data-reel-id="${reel.$id}"><div class="action-icon">↗️</div><div class="action-count">${reel.shares || 0}</div></button>
          <button class="fullscreen-action-btn exit-btn"><div class="action-icon">✕</div></button>
        </div>
        <div class="fullscreen-info"><h2>${escapeHtml(reel.title)}</h2><p>${escapeHtml(reel.description || '')}</p></div>
      </div>`;
    this.setupFullscreenEventListeners();
  }

  renderVideoCard(reel) {
    const isLiked = this.likedReels.has(reel.$id);
    const creator = this.getCreator(reel);
    const creatorName = escapeHtml(creator.name || 'GorkhaReels Creator');
    const creatorPic = creator.profilePic || 'assets/logo.png';
    const profileUrl = `./creator-profile.html?id=${reel.creatorId}`;
    return `
      <div class="video-card">
        <video class="video-player" src="${reel.videoUrl}" loop playsinline preload="metadata"></video>
        <div class="video-overlay">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;cursor:pointer;" onclick="window.location.href='${profileUrl}'">
            <img src="${creatorPic}" onerror="this.src='assets/logo.png'" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.6);">
            <div><div style="font-size:14px;font-weight:700;color:#fff;">@${creatorName}</div></div>
          </div>
          <span class="video-category">${escapeHtml(reel.category || 'General')}</span>
          <h2 class="video-title">${escapeHtml(reel.title)}</h2>
          <p class="video-description">${escapeHtml(reel.description || '')}</p>
        </div>
        <div class="action-buttons">
          <button class="action-btn like-btn ${isLiked? 'liked' : ''}" data-reel-id="${reel.$id}">❤️<span class="action-count">${reel.likes || 0}</span></button>
          <button class="action-btn comment-btn" data-reel-id="${reel.$id}">💬<span class="action-count">${reel.comments || 0}</span></button>
          <button class="action-btn share-btn" data-reel-id="${reel.$id}">↗️<span class="action-count">${reel.shares || 0}</span></button>
          <button class="action-btn fullscreen-btn" data-reel-id="${reel.$id}">⛶<span class="action-count"></span></button>
        </div>
      </div>`;
  }

  setupCardEventListeners() {
    document.querySelector('.like-btn')?.addEventListener('click', (e) => this.toggleLike(e.currentTarget.dataset.reelId));
    document.querySelector('.comment-btn')?.addEventListener('click', (e) => this.openComments(e.currentTarget.dataset.reelId));
    document.querySelector('.share-btn')?.addEventListener('click', (e) => this.shareVideo(e.currentTarget.dataset.reelId));
    document.querySelector('.fullscreen-btn')?.addEventListener('click', () => this.enterFullscreen());
    const video = document.querySelector('.video-player');
    if (video) {
      video.addEventListener('click', () => { if (video.paused) video.play(); else video.pause(); });
      video.addEventListener('dblclick', () => this.enterFullscreen());
    }
  }

  setupFullscreenEventListeners() {
    document.querySelector('.like-btn')?.addEventListener('click', (e) => this.toggleLike(e.currentTarget.dataset.reelId));
    document.querySelector('.comment-btn')?.addEventListener('click', (e) => this.openComments(e.currentTarget.dataset.reelId));
    document.querySelector('.share-btn')?.addEventListener('click', (e) => this.shareVideo(e.currentTarget.dataset.reelId));
    document.querySelector('.exit-btn')?.addEventListener('click', () => this.exitFullscreen());
    const video = document.querySelector('.video-player');
    if (video) video.addEventListener('click', () => { if (video.paused) video.play().catch(()=>{}); else video.pause(); });
  }

  enterFullscreen() {
    this.isFullscreen = true;
    const container = document.getElementById('feed-container');
    if (container) container.requestFullscreen().catch(()=>{});
    this.displayCurrentVideo();
  }

  exitFullscreen() {
    this.isFullscreen = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
    this.displayCurrentVideo();
  }

  incrementViews(reel) {
    if (this.viewTimers[reel.$id]) clearTimeout(this.viewTimers[reel.$id]);
    this.viewTimers[reel.$id] = setTimeout(async () => {
      try {
        await db.update(APPWRITE_CONFIG.COLLECTIONS.REELS, reel.$id, { views: (reel.views || 0) + 1 });
        delete this.viewTimers[reel.$id];
      } catch (e) {}
    }, 3000);
  }

  // LIKES FIXED WITH PERMISSIONS
  async toggleLike(reelId) {
    if (!session.isLoggedIn()) { window.location.href = './login.html'; return; }
    const likeButton = document.querySelector(`.like-btn[data-reel-id="${reelId}"]`);
    const isLiked = this.likedReels.has(reelId);
    const userId = session.getUserId();
    const countEl = likeButton?.querySelector('.action-count');
    const currentCount = parseInt(countEl?.textContent || '0');

    try {
      if (isLiked) {
        this.likedReels.delete(reelId);
        likeButton?.classList.remove('liked');
        if (countEl) countEl.textContent = Math.max(0, currentCount - 1);
        const likes = await db.list(APPWRITE_CONFIG.COLLECTIONS.LIKES, [
          Query.equal('creatorId', userId),
          Query.equal('reelId', reelId),
          Query.limit(1)
        ]);
        if (likes.documents.length > 0) await db.remove(APPWRITE_CONFIG.COLLECTIONS.LIKES, likes.documents[0].$id);
      } else {
        this.likedReels.add(reelId);
        likeButton?.classList.add('liked');
        if (countEl) countEl.textContent = currentCount + 1;
        await db.create(APPWRITE_CONFIG.COLLECTIONS.LIKES, {
          likeId: ID.unique(),
          reelId: reelId,
          creatorId: userId,
          createdAt: new Date().toISOString()
        }, null, [Permission.read(Role.any()), Permission.delete(Role.user(userId))]);
        if (likeButton) { likeButton.style.transform = 'scale(1.3)'; setTimeout(()=>likeButton.style.transform='',200); }
      }
    } catch (error) {
      console.error('Like failed:', error);
      Toast.error('❌ Like failed');
      if (isLiked) { this.likedReels.add(reelId); likeButton?.classList.add('liked'); }
      else { this.likedReels.delete(reelId); likeButton?.classList.remove('liked'); }
      if (countEl) countEl.textContent = currentCount;
    }
  }

  async openComments(reelId) { /*... keep your existing comments code... */ }
  async loadComments(reelId) { /*... */ }
  async postComment(reelId) { /*... */ }
  shareVideo(reelId) { /*... */ }
  openSearch() { /*... */ }
  closeSearch() { /*... */ }
  handleSearchInput(query) { /*... */ }
  async searchReels(query) { /*... */ }
  playFromSearch(reelId) {
    this.closeSearch();
    const idx = this.reels.findIndex(r => r.$id === reelId);
    if (idx!== -1) {
      this.currentIndex = idx;
      this.displayCurrentVideo();
    } else {
      Toast.info('Loading video...');
      db.get(APPWRITE_CONFIG.COLLECTIONS.REELS, reelId).then(reel => {
        this.reels = [reel];
        this.currentIndex = 0;
        this.displayCurrentVideo();
      }).catch(() => Toast.error('Could not load video'));
    }
  }
  handleNavClick(e) { /*... */ }
  async loadTrending() { /*... */ }
  showEmptyState() { /*... */ }
  showLoginPrompt() { /*... */ }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { window.feedManager = new FeedManager(); });
} else {
  window.feedManager = new FeedManager();
}