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

      // Wire up bottom navigation buttons
      this.setupNavigation();
    } catch(e) {
      console.error('Init error:', e);
      Toast.error('Load failed: ' + e.message);
    }
  }

  setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const nav = btn.dataset.nav;
        switch(nav) {
          case 'home':
            // Reload feed
            this.currentIndex = 0;
            if (this.reels.length) this.displayCurrentVideo();
            break;
          case 'trending':
            this.loadTrending();
            break;
          case 'create':
            location.href = './upload.html';
            break;
          case 'profile':
            location.href = './creator-dashboard.html';
            break;
        }
      });
    });
  }

  async loadTrending() {
    try {
      Toast.info('Loading trending 🔥');
      const response = await db.list(APPWRITE_CONFIG.COLLECTIONS.REELS, [
        Query.equal('isDeleted', false),
        Query.orderDesc('views'),
        Query.limit(20)
      ]);
      if (response.documents.length === 0) {
        Toast.error('No trending videos yet');
        return;
      }
      // Score by views + likes*3 + comments*2
      this.reels = response.documents
        .map(r => ({ ...r, _score: (r.views||0) + ((r.likes||0)*3) + ((r.comments||0)*2) }))
        .sort((a,b) => b._score - a._score);
      this.currentIndex = 0;
      this.displayCurrentVideo();
      Toast.success('Trending now 🔥');
    } catch(e) {
      console.error('Trending failed:', e);
      Toast.error('Failed to load trending');
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

        <!-- Tap to unmute hint -->
        <div class="unmute-hint" style="position:absolute;top:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;pointer-events:none;transition:opacity 0.3s">
          🔇 Tap for sound
        </div>

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

    const video = document.querySelector('video');
    const hint = document.querySelector('.unmute-hint');

    // Tap video to toggle mute/unmute
    video.addEventListener('click', () => {
      video.muted = !video.muted;
      if (hint) {
        hint.innerHTML = video.muted ? '🔇 Tap for sound' : '🔊 Sound on';
        hint.style.opacity = '1';
        if (!video.muted) {
          setTimeout(() => { hint.style.opacity = '0'; }, 1500);
        }
      }
    });

    document.querySelector('.like-btn').onclick = (e) => {
      e.stopPropagation();
      this.toggleLike(reel.$id);
    };
    video.play().catch(()=>{});

    // Auto-hide hint after 3s
    if (hint) setTimeout(() => { if (video.muted) hint.style.opacity = '0.5'; }, 3000);
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
          // Your LIKES collection requires a 'likeId' field
          await db.create(APPWRITE_CONFIG.COLLECTIONS.LIKES, {
            likeId: ID.unique(),
            userId: userId,
            reelId: reelId,
            creatorId: this.currentVideo.creatorId,
            createdAt: new Date().toISOString()
          });
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

  // Search button handler (header 🔍) — uses the search overlay in index.html
  openSearch() {
    const overlay = document.getElementById('search-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    const input = document.getElementById('search-input-field');
    if (input) {
      setTimeout(() => input.focus(), 100);
      input.oninput = (e) => this.handleSearchInput(e.target.value.trim());
    }
  }

  closeSearch() {
    const overlay = document.getElementById('search-overlay');
    if (overlay) overlay.style.display = 'none';
    const input = document.getElementById('search-input-field');
    if (input) input.value = '';
  }

  handleSearchInput(query) {
    const results = document.getElementById('search-results');
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';
    if (!results) return;

    if (!query || query.length < 2) {
      results.innerHTML = `<div style="text-align:center;color:#737373;padding:60px 20px;"><div style="font-size:40px;margin-bottom:12px;">🎬</div><p>Search for videos by title</p></div>`;
      return;
    }

    const q = query.toLowerCase();
    const matched = this.reels.filter(r =>
      (r.title||'').toLowerCase().includes(q) ||
      (r.description||'').toLowerCase().includes(q) ||
      (r.category||'').toLowerCase().includes(q)
    );

    if (matched.length === 0) {
      results.innerHTML = `<div style="text-align:center;color:#737373;padding:60px 20px;"><div style="font-size:40px;margin-bottom:12px;">😕</div><p>No videos found</p></div>`;
      return;
    }

    results.innerHTML = matched.map(r => {
      const idx = this.reels.findIndex(x => x.$id === r.$id);
      return `
      <div onclick="window.feedManager.playFromSearch(${idx})" style="display:flex;gap:12px;align-items:center;background:#1a1a1a;border-radius:12px;padding:10px;cursor:pointer;border:1px solid #2d2d2d;margin-bottom:10px;">
        <div style="width:56px;height:72px;flex-shrink:0;border-radius:8px;overflow:hidden;background:#242424;">
          <img src="${r.thumbnail || 'assets/logo.png'}" onerror="this.src='assets/logo.png'" style="width:100%;height:100%;object-fit:cover;">
        </div>
        <div style="flex:1;min-width:0;">
          <p style="color:#fff;font-weight:600;font-size:14px;margin:0 0 4px;">${r.title || 'Untitled'}</p>
          <p style="color:#a3a3a3;font-size:12px;margin:0;">👁️ ${r.views||0} · ❤️ ${r.likes||0}</p>
        </div>
      </div>`;
    }).join('');
  }

  playFromSearch(idx) {
    this.closeSearch();
    if (idx >= 0 && idx < this.reels.length) {
      this.currentIndex = idx;
      this.displayCurrentVideo();
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
