/**
 * GorkhaReels - Production Feed (FIXED likes + counter)
 */
class FeedManager {
  constructor() {
    this.reels = []; this.currentIndex = 0; this.isLoading = false;
    this.currentVideo = null; this.likedReels = new Set(); this.isFullscreen = false;
    this.init();
  }

  async init() {
    await session.refresh();
    if (!session.isLoggedIn()) { location.href='./login.html'; return; }

    try {
      const response = await db.list(APPWRITE_CONFIG.COLLECTIONS.REELS, [
        Query.equal('isDeleted', false),
        Query.orderDesc('uploadedAt'),
        Query.limit(20)
      ]);
      this.reels = response.documents;

      await this.loadUserLikes();

      if (this.reels.length > 0) {
        this.displayCurrentVideo();
        this.setupSwipe();
      }
    } catch(e) {
      console.error('Init error:', e);
      Toast.error('Load failed: ' + e.message);
    }
  }

  async loadUserLikes() {
    try {
      const userId = session.getUserId();
      const likes = await db.list(APPWRITE_CONFIG.COLLECTIONS.LIKES, [
        Query.equal('userId', userId),
        Query.limit(100)
      ]);
      // FIX: store reelId values — we compare against reel.$id below,
      // so we must save likes keyed by the SAME id we check with.
      this.likedReels = new Set(likes.documents.map(l => l.reelId));
      console.log(`✅ Loaded ${this.likedReels.size} likes`);
    } catch(e) {
      console.warn('Likes load failed (permissions?)', e);
      this.likedReels = new Set();
    }
  }

  displayCurrentVideo() {
    const reel = this.reels[this.currentIndex];
    this.currentVideo = reel;
    // FIX: check using reel.$id (the document id), consistent everywhere
    const isLiked = this.likedReels.has(reel.$id);

    document.getElementById('feed-container').innerHTML = `
      <div class="video-card">
        <video class="video-player" src="${reel.videoUrl}" loop playsinline autoplay muted style="width:100%;height:100vh;object-fit:cover"></video>
        <div style="position:absolute;right:15px;bottom:120px;display:flex;flex-direction:column;gap:20px;align-items:center">
          <button class="like-btn" data-id="${reel.$id}" style="background:${isLiked?'#ff3b30':'rgba(0,0,0,0.6)'};border:none;width:55px;height:55px;border-radius:50%;color:white;font-size:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.3)">❤️</button>
          <div class="like-count" style="color:white;font-size:12px;margin-top:-15px">${reel.likes||0}</div>

          <button style="background:rgba(0,0,0,0.6);border:none;width:55px;height:55px;border-radius:50%;color:white;font-size:24px">💬</button>
          <button style="background:rgba(0,0,0,0.6);border:none;width:55px;height:55px;border-radius:50%;color:white;font-size:24px">↗️</button>
        </div>
        <div style="position:absolute;bottom:80px;left:15px;right:80px;color:white">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px" onclick="location.href='./creator-profile.html?id=${reel.creatorId}'">
            <img src="${reel.creatorProfilePic || 'assets/logo.png'}" onerror="this.src='assets/logo.png'" style="width:36px;height:36px;border-radius:50%;border:2px solid white">
            <span style="font-weight:700">@${reel.creatorName || 'creator'}</span>
          </div>
          <h3 style="margin:0 0 5px;font-size:16px">${reel.title}</h3>
        </div>
      </div>
    `;

    document.querySelector('.like-btn').onclick = () => this.toggleLike(reel.$id);
    document.querySelector('video').play().catch(()=>{});
  }

  async toggleLike(reelId) {
    const userId = session.getUserId();
    const isLiked = this.likedReels.has(reelId);
    const btn = document.querySelector('.like-btn');
    const countEl = document.querySelector('.like-count');

    // Prevent double-tap spam while processing
    if (btn.dataset.busy === '1') return;
    btn.dataset.busy = '1';

    try {
      if (isLiked) {
        // ===== UNLIKE =====
        this.likedReels.delete(reelId);
        btn.style.background = 'rgba(0,0,0,0.6)';

        // Find and delete the like record
        const likes = await db.list(APPWRITE_CONFIG.COLLECTIONS.LIKES, [
          Query.equal('userId', userId),
          Query.equal('reelId', reelId),
          Query.limit(1)
        ]);
        if (likes.documents[0]) {
          await db.remove(APPWRITE_CONFIG.COLLECTIONS.LIKES, likes.documents[0].$id);
        }

        // Decrement counter on the reel
        const newCount = Math.max(0, (this.currentVideo.likes || 1) - 1);
        await db.update(APPWRITE_CONFIG.COLLECTIONS.REELS, reelId, { likes: newCount });
        this.currentVideo.likes = newCount;
        if (countEl) countEl.textContent = newCount;

        Toast.success('Unliked');
      } else {
        // ===== LIKE =====
        // SAFETY: check DB first to avoid duplicate-document errors
        const existing = await db.list(APPWRITE_CONFIG.COLLECTIONS.LIKES, [
          Query.equal('userId', userId),
          Query.equal('reelId', reelId),
          Query.limit(1)
        ]);

        if (existing.documents.length === 0) {
          // Only create if it doesn't already exist
          await db.create(
            APPWRITE_CONFIG.COLLECTIONS.LIKES,
            ID.unique(),   // FIX: document ID goes HERE, not in the data
            {
              userId: userId,
              reelId: reelId,
              creatorId: this.currentVideo.creatorId,
              createdAt: new Date().toISOString()
            }
          );
        }

        this.likedReels.add(reelId);
        btn.style.background = '#ff3b30';
        btn.style.transform = 'scale(1.2)';
        setTimeout(()=>btn.style.transform='scale(1)',200);

        // Increment counter on the reel
        const newCount = (this.currentVideo.likes || 0) + 1;
        await db.update(APPWRITE_CONFIG.COLLECTIONS.REELS, reelId, { likes: newCount });
        this.currentVideo.likes = newCount;
        if (countEl) countEl.textContent = newCount;

        Toast.success('❤️ Liked!');
      }
    } catch(e) {
      console.error('Like error:', e);
      Toast.error('Like failed: ' + e.message);
      // Revert visual state on error
      if (isLiked) this.likedReels.add(reelId); else this.likedReels.delete(reelId);
      btn.style.background = this.likedReels.has(reelId) ? '#ff3b30' : 'rgba(0,0,0,0.6)';
    } finally {
      btn.dataset.busy = '0';
    }
  }

  setupSwipe() {
    let startY = 0;
    document.addEventListener('touchstart', e => startY = e.touches[0].clientY, {passive:true});
    document.addEventListener('touchend', e => {
      const diff = startY - e.changedTouches[0].clientY;
      if (Math.abs(diff) > 80) {
        if (diff > 0 && this.currentIndex < this.reels.length-1) {
          this.currentIndex++; this.displayCurrentVideo();
        } else if (diff < 0 && this.currentIndex > 0) {
          this.currentIndex--; this.displayCurrentVideo();
        }
      }
    }, {passive:true});
  }
}

window.feedManager = new FeedManager();
