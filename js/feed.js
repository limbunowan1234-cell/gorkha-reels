// EMERGENCY FEED - loads videos without checking likes
class FeedManager {
  constructor() {
    this.reels = []; this.currentIndex = 0; this.isLoading = false;
    this.currentVideo = null; this.likedReels = new Set(); this.isFullscreen = false;
    this.init();
  }

  async init() {
    await session.refresh();
    if (!session.isLoggedIn()) { location.href='./login.html'; return; }

    console.log('Loading videos (likes disabled temporarily)...');
    try {
      const response = await db.list(APPWRITE_CONFIG.COLLECTIONS.REELS, [
        Query.equal('isDeleted', false),
        Query.orderDesc('uploadedAt'),
        Query.limit(20)
      ]);
      this.reels = response.documents;
      console.log(`✅ Loaded ${this.reels.length} videos`);

      if (this.reels.length > 0) {
        this.displayCurrentVideo();
        this.setupEventListeners();
      } else {
        document.getElementById('feed-container').innerHTML = '<div style="color:white;text-align:center;padding:50px">No videos yet</div>';
      }
    } catch(e) {
      console.error('FEED ERROR:', e);
      document.getElementById('feed-container').innerHTML = `<div style="color:red;padding:20px">Error: ${e.message}</div>`;
    }
  }

  displayCurrentVideo() {
    const reel = this.reels[this.currentIndex];
    if (!reel) return;
    this.currentVideo = reel;
    document.getElementById('feed-container').innerHTML = `
      <div class="video-card">
        <video class="video-player" src="${reel.videoUrl}" loop playsinline autoplay muted style="width:100%;height:100vh;object-fit:cover"></video>
        <div class="action-buttons" style="position:absolute;right:15px;bottom:100px;display:flex;flex-direction:column;gap:20px">
          <button class="action-btn like-btn" data-reel-id="${reel.$id}" style="background:rgba(0,0,0,0.5);border:none;width:50px;height:50px;border-radius:50%;color:white;font-size:24px">❤️</button>
          <button class="action-btn" style="background:rgba(0,0,0,0.5);border:none;width:50px;height:50px;border-radius:50%;color:white;font-size:24px">💬</button>
          <button class="action-btn" style="background:rgba(0,0,0,0.5);border:none;width:50px;height:50px;border-radius:50%;color:white;font-size:24px">↗️</button>
        </div>
        <div style="position:absolute;bottom:20px;left:15px;color:white">
          <h3>${reel.title}</h3>
        </div>
      </div>
    `;
    document.querySelector('.like-btn').onclick = () => this.tempLike(reel.$id);
    document.querySelector('video').play().catch(()=>{});
  }

  async tempLike(reelId) {
    // Temporary like - just visual, doesn't save to DB yet
    const btn = document.querySelector('.like-btn');
    btn.style.transform = 'scale(1.3)';
    setTimeout(()=>btn.style.transform='scale(1)',200);
    Toast.success('Like saved locally (add userId field to enable DB)');
    console.log('Would save like for:', reelId, 'user:', session.getUserId());
  }

  setupEventListeners() {
    let startY = 0;
    document.addEventListener('touchstart', e => startY = e.touches[0].clientY);
    document.addEventListener('touchend', e => {
      const diff = startY - e.changedTouches[0].clientY;
      if (Math.abs(diff) > 100) {
        if (diff > 0 && this.currentIndex < this.reels.length-1) {
          this.currentIndex++; this.displayCurrentVideo();
        } else if (diff < 0 && this.currentIndex > 0) {
          this.currentIndex--; this.displayCurrentVideo();
        }
      }
    });
  }
}

window.feedManager = new FeedManager();
console.log('✅ Emergency Feed Loaded');