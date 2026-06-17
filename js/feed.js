/**
 * GorkhaReels - Feed Logic
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
    
    // Check if user is logged in
    if (!session.isLoggedIn()) {
      this.showLoginPrompt();
      return;
    }

    // Load initial reels
    await this.loadReels();
    this.setupEventListeners();
    this.displayCurrentVideo();
  }

  /**
   * Load reels from Appwrite
   */
  async loadReels() {
    if (this.isLoading || !this.hasMore) return;
    
    this.isLoading = true;
    try {
      const offset = this.reels.length;
      const response = await appwrite.getDocuments(
        APPWRITE_CONFIG.COLLECTIONS.REELS,
        [
          `limit=${this.pageSize}`,
          `offset=${offset}`,
          `orderBy[]=$id`
        ]
      );

      this.reels = [...this.reels, ...response.documents];
      this.hasMore = response.documents.length === this.pageSize;

      console.log(`✅ Loaded ${response.documents.length} reels`);
    } catch (error) {
      console.error('Error loading reels:', error);
      Toast.error('Failed to load reels');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Swipe/scroll for next video
    document.addEventListener('wheel', (e) => this.handleScroll(e), { passive: false });
    document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    document.addEventListener('touchstart', (e) => this.handleTouchStart(e));
    document.addEventListener('touchend', (e) => this.handleTouchEnd(e));

    // Action buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleActionClick(e));
    });

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => this.handleNavClick(e));
    });

    // Intersection observer for lazy loading
    this.setupIntersectionObserver();
  }

  /**
   * Handle scroll to next video
   */
  handleScroll(e) {
    if (e.deltaY > 0) {
      this.nextVideo();
    } else if (e.deltaY < 0) {
      this.previousVideo();
    }
  }

  /**
   * Handle touch swipe
   */
  touchStartY = 0;
  touchEndY = 0;

  handleTouchStart(e) {
    this.touchStartY = e.changedTouches[0].screenY;
  }

  handleTouchMove(e) {
    e.preventDefault();
  }

  handleTouchEnd(e) {
    this.touchEndY = e.changedTouches[0].screenY;
    const diff = this.touchStartY - this.touchEndY;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        this.nextVideo();
      } else {
        this.previousVideo();
      }
    }
  }

  /**
   * Next video
   */
  nextVideo() {
    if (this.currentIndex < this.reels.length - 1) {
      this.currentIndex++;
      this.displayCurrentVideo();

      // Load more if near end
      if (this.currentIndex >= this.reels.length - 3) {
        this.loadReels();
      }
    }
  }

  /**
   * Previous video
   */
  previousVideo() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.displayCurrentVideo();
    }
  }

  /**
   * Display current video
   */
  displayCurrentVideo() {
    const reel = this.reels[this.currentIndex];
    if (!reel) return;

    this.currentVideo = reel;

    // Update HTML
    const container = document.getElementById('feed-container');
    if (!container) return;

    container.innerHTML = this.renderVideoCard(reel);
    
    // Re-attach event listeners
    this.setupCardEventListeners();
    
    // Auto-play video
    const video = document.querySelector('.video-player');
    if (video) {
      video.play().catch(e => console.log('Autoplay blocked:', e));
    }

    console.log(`Showing reel ${this.currentIndex + 1}/${this.reels.length}`);
  }

  /**
   * Render video card HTML
   */
  renderVideoCard(reel) {
    const isLiked = this.likedReels.has(reel.$id);
    const creatorVerified = reel.isVerified ? '✓' : '';

    return `
      <div class="video-card">
        <video class="video-player" src="${reel.videoUrl}" preload="metadata"></video>
        
        <div class="video-overlay">
          <span class="video-category">${reel.category || 'General'}</span>
          
          <h2 class="video-title">${reel.title}</h2>
          
          <div class="video-meta">
            <span>${reel.views || 0} views</span>
            <span>•</span>
            <span>${reel.language || 'Nepali'}</span>
          </div>

          <div class="creator-info">
            <img src="${reel.creatorPic || 'https://via.placeholder.com/40'}" alt="Creator" class="creator-avatar">
            <div class="creator-details">
              <div class="creator-name">${reel.creatorName} ${creatorVerified}</div>
              <div class="creator-followers">${reel.creatorFollowers || 0} followers</div>
            </div>
            <button class="follow-btn" data-creator-id="${reel.creatorId}">Follow</button>
          </div>

          <p class="video-description">${reel.description || ''}</p>
          
          <div class="video-hashtags">${this.formatHashtags(reel.hashtags)}</div>
        </div>

        <div class="action-buttons">
          <button class="action-btn like-btn ${isLiked ? 'liked' : ''}" data-reel-id="${reel.$id}" title="Like">
            ❤️
            <span class="action-count">${reel.likes || 0}</span>
          </button>
          <button class="action-btn comment-btn" data-reel-id="${reel.$id}" title="Comment">
            💬
            <span class="action-count">${reel.comments || 0}</span>
          </button>
          <button class="action-btn share-btn" data-reel-id="${reel.$id}" title="Share">
            ↗️
            <span class="action-count">${reel.shares || 0}</span>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Format hashtags
   */
  formatHashtags(hashtags) {
    if (!hashtags) return '';
    return hashtags.split(' ').filter(tag => tag.startsWith('#')).slice(0, 3).join(' ');
  }

  /**
   * Setup card event listeners
   */
  setupCardEventListeners() {
    // Like button
    document.querySelector('.like-btn')?.addEventListener('click', async (e) => {
      await this.toggleLike(e.currentTarget.dataset.reelId);
    });

    // Comment button
    document.querySelector('.comment-btn')?.addEventListener('click', (e) => {
      this.showCommentModal(e.currentTarget.dataset.reelId);
    });

    // Share button
    document.querySelector('.share-btn')?.addEventListener('click', (e) => {
      this.shareVideo(e.currentTarget.dataset.reelId);
    });

    // Follow button
    document.querySelector('.follow-btn')?.addEventListener('click', async (e) => {
      await this.toggleFollow(e.currentTarget.dataset.creatorId);
    });

    // Video player
    const video = document.querySelector('.video-player');
    if (video) {
      video.addEventListener('click', () => {
        if (video.paused) {
          video.play();
        } else {
          video.pause();
        }
      });
    }
  }

  /**
   * Toggle like
   */
  async toggleLike(reelId) {
    if (!session.isLoggedIn()) {
      this.showLoginPrompt();
      return;
    }

    try {
      const isLiked = this.likedReels.has(reelId);
      const likeButton = document.querySelector('.like-btn');

      if (isLiked) {
        // Unlike
        this.likedReels.delete(reelId);
        likeButton.classList.remove('liked');
        
        // Update like count
        const currentReel = this.currentVideo;
        currentReel.likes = Math.max(0, (currentReel.likes || 1) - 1);
      } else {
        // Like
        this.likedReels.add(reelId);
        likeButton.classList.add('liked');
        
        // Update like count
        const currentReel = this.currentVideo;
        currentReel.likes = (currentReel.likes || 0) + 1;
      }

      // Update UI
      const countElement = likeButton.querySelector('.action-count');
      countElement.textContent = this.currentVideo.likes;

      // Save to Appwrite (in background)
      await this.saveLike(reelId, isLiked);
    } catch (error) {
      console.error('Error toggling like:', error);
      Toast.error('Failed to update like');
    }
  }

  /**
   * Save like to database
   */
  async saveLike(reelId, isRemoving) {
    try {
      if (isRemoving) {
        // Find and delete the like document
        const likes = await appwrite.getDocuments(
          APPWRITE_CONFIG.COLLECTIONS.LIKES,
          [
            `queries[]=reelId=${reelId}`,
            `queries[]=creatorId=${session.getUserId()}`
          ]
        );

        if (likes.documents.length > 0) {
          await appwrite.deleteDocument(
            APPWRITE_CONFIG.COLLECTIONS.LIKES,
            likes.documents[0].$id
          );
        }
      } else {
        // Create new like
        await appwrite.createDocument(
          APPWRITE_CONFIG.COLLECTIONS.LIKES,
          {
            reelId,
            creatorId: session.getUserId()
          }
        );
      }
    } catch (error) {
      console.error('Error saving like:', error);
    }
  }

  /**
   * Toggle follow
   */
  async toggleFollow(creatorId) {
    if (!session.isLoggedIn()) {
      this.showLoginPrompt();
      return;
    }

    try {
      const followBtn = document.querySelector('.follow-btn');
      const isFollowing = followBtn.classList.contains('following');

      if (isFollowing) {
        followBtn.classList.remove('following');
        followBtn.textContent = 'Follow';
      } else {
        followBtn.classList.add('following');
        followBtn.textContent = 'Following';
      }

      // Save to database
      if (!isFollowing) {
        await appwrite.createDocument(
          APPWRITE_CONFIG.COLLECTIONS.FOLLOWERS,
          {
            followerId: session.getUserId(),
            followingId: creatorId
          }
        );
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      Toast.error('Failed to update follow');
    }
  }

  /**
   * Show comment modal
   */
  showCommentModal(reelId) {
    console.log('Opening comments for reel:', reelId);
    // TODO: Implement comment modal
    Toast.success('Comments coming soon!');
  }

  /**
   * Share video
   */
  shareVideo(reelId) {
    const url = `${window.location.origin}/?reel=${reelId}`;
    
    if (navigator.share) {
      navigator.share({
        title: this.currentVideo.title,
        text: this.currentVideo.description,
        url
      }).catch(err => console.log('Share failed:', err));
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(url);
      Toast.success('Link copied!');
    }

    // Update share count
    this.currentVideo.shares = (this.currentVideo.shares || 0) + 1;
  }

  /**
   * Handle action clicks
   */
  handleActionClick(e) {
    console.log('Action clicked:', e.currentTarget);
  }

  /**
   * Handle navigation
   */
  handleNavClick(e) {
    const nav = e.currentTarget.dataset.nav || e.currentTarget.textContent.toLowerCase();
    
    switch(nav) {
      case 'home':
      case 'feed':
        window.location.href = '/';
        break;
      case 'upload':
      case 'create':
        window.location.href = '/upload.html';
        break;
      case 'dashboard':
      case 'profile':
        window.location.href = '/creator-dashboard.html';
        break;
      case 'trending':
        this.loadTrendingReels();
        break;
    }
  }

  /**
   * Load trending reels
   */
  async loadTrendingReels() {
    try {
      const trending = await appwrite.getDocuments(
        APPWRITE_CONFIG.COLLECTIONS.TRENDING,
        [`limit=20`, `orderBy[]=rank`]
      );

      this.reels = trending.documents;
      this.currentIndex = 0;
      this.displayCurrentVideo();
      Toast.success('Showing trending');
    } catch (error) {
      console.error('Error loading trending:', error);
      Toast.error('Failed to load trending');
    }
  }

  /**
   * Setup intersection observer for lazy loading
   */
  setupIntersectionObserver() {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const video = entry.target;
          if (video.dataset.src && !video.src) {
            video.src = video.dataset.src;
          }
        }
      });
    });

    document.querySelectorAll('video').forEach(video => observer.observe(video));
  }

  /**
   * Show login prompt
   */
  showLoginPrompt() {
    const message = `
      <div style="text-align: center; padding: 40px 20px;">
        <h2 style="color: var(--primary-red); margin-bottom: 20px;">Welcome to GorkhaReels</h2>
        <p style="margin-bottom: 20px;">Sign in to watch, like, and share reels</p>
        <button class="btn btn-primary" onclick="location.href='/login.html'" style="max-width: 300px;">
          Sign In
        </button>
      </div>
    `;

    const container = document.getElementById('feed-container');
    if (container) {
      container.innerHTML = message;
    }
  }
}

// Initialize feed when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.feedManager = new FeedManager();
  });
} else {
  window.feedManager = new FeedManager();
}

console.log('✅ Feed Manager Loaded');
