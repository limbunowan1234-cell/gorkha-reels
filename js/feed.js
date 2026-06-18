/**
 * GorkhaReels - Feed Logic (FIXED for userId)
 */
class FeedManager {
  constructor() {
    this.reels = []; this.currentIndex = 0; this.isLoading = false; this.hasMore = true;
    this.pageSize = 10; this.currentVideo = null; this.likedReels = new Set();
    this.isFullscreen = false; this.viewTimers = {}; this.lastTimestamp = null;
    this.mode = 'recommended'; this.creatorsCache = {}; this.init();
  }

  async init() {
    await session.refresh();
    if (!session.isLoggedIn()) { this.showLoginPrompt(); return; }
    await this.loadRecommended();
    this.setupEventListeners();
    if (this.reels.length === 0) this.showEmptyState(); else this.displayCurrentVideo();
  }

  async loadRecommended() {
    if (this.isLoading) return; this.isLoading = true; this.mode = 'recommended';
    try {
      let preferredCategories = []; const userId = session.getUserId();
      const likes = await db.list(APPWRITE_CONFIG.COLLECTIONS.LIKES, [
        Query.equal('userId', userId), // FIXED: was creatorId
        Query.orderDesc('createdAt'), Query.limit(10)
      ]);
      if (likes.documents.length > 0) {
        for (const like of likes.documents.slice(0,5)) {
          try { const reel = await db.get(APPWRITE_CONFIG.COLLECTIONS.REELS, like.reelId);
            if (reel.category) preferredCategories.push(reel.category);
          } catch(e){}
        }
      }
      let queries = preferredCategories.length > 0? [
        Query.equal('isDeleted', false),
        Query.equal('category', preferredCategories[0]),
        Query.orderDesc('likes'), Query.limit(20)
      ] : [ Query.equal('isDeleted', false), Query.orderDesc('uploadedAt'), Query.limit(20) ];

      const response = await db.list(APPWRITE_CONFIG.COLLECTIONS.REELS, queries);
      this.reels = response.documents; this.hasMore = false;
      await this.loadUserLikes(); await this.loadCreatorCache(this.reels);
    } catch(e){ await this.loadFallbackReels(); } finally { this.isLoading = false; }
  }

  async loadFallbackReels() {
    const response = await db.list(APPWRITE_CONFIG.COLLECTIONS.REELS, [
      Query.equal('isDeleted', false), Query.orderDesc('uploadedAt'), Query.limit(20)
    ]);
    this.reels = response.documents; await this.loadUserLikes();
  }

  async loadUserLikes() {
    try {
      if (!session.isLoggedIn()) return;
      const userId = session.getUserId();
      const response = await db.list(APPWRITE_CONFIG.COLLECTIONS.LIKES, [
        Query.equal('userId', userId), // FIXED
        Query.limit(1000)
      ]);
      this.likedReels = new Set(response.documents.map(l => l.reelId));
    } catch(e){}
  }

  //... [keep all your other functions: loadCreatorCache, setupEventListeners, handleScroll, nextVideo, etc. - unchanged]...

  async loadCreatorCache(reels) {
    const uncachedIds = [...new Set(reels.map(r => r.creatorId).filter(id => id &&!this.creatorsCache[id]))];
    for (const id of uncachedIds) {
      try { this.creatorsCache[id] = await db.get(APPWRITE_CONFIG.COLLECTIONS.CREATORS, id); }
      catch { this.creatorsCache[id] = { name: 'GorkhaReels Creator', profilePic: '' }; }
    }
  }
  getCreator(reel){ return reel.creatorName? {name:reel.creatorName, profilePic:reel.creatorProfilePic||''} : this.creatorsCache[reel.creatorId] || {name:'GorkhaReels Creator',profilePic:''}; }
  setupEventListeners(){ document.addEventListener('wheel',e=>this.handleScroll(e),{passive:true}); document.addEventListener('touchstart',e=>this.handleTouchStart(e),{passive:true}); document.addEventListener('touchend',e=>this.handleTouchEnd(e),{passive:true}); document.addEventListener('keydown',e=>this.handleKeypress(e)); document.querySelectorAll('.nav-item').forEach(i=>i.addEventListener('click',e=>this.handleNavClick(e))); }
  handleScroll(e){ if(this._scrollLock||this.isFullscreen)return; this._scrollLock=true; setTimeout(()=>this._scrollLock=false,600); e.deltaY>0?this.nextVideo():this.previousVideo(); }
  touchStartY=0; handleTouchStart(e){this.touchStartY=e.changedTouches[0].screenY;} handleTouchEnd(e){if(this.isFullscreen)return; const d=this.touchStartY-e.changedTouches[0].screenY; if(Math.abs(d)>120) d>0?this.nextVideo():this.previousVideo();}
  handleKeypress(e){ if(e.key==='Escape'&&this.isFullscreen)this.exitFullscreen(); }
  nextVideo(){ if(this.currentIndex<this.reels.length-1){this.currentIndex++;this.displayCurrentVideo();} }
  previousVideo(){ if(this.currentIndex>0){this.currentIndex--;this.displayCurrentVideo();} }
  displayCurrentVideo(){ const r=this.reels[this.currentIndex]; if(!r)return; this.currentVideo=r; this.isFullscreen?this.displayFullscreenVideo(r):this.displayNormalVideo(r); document.querySelector('.video-player')?.play().catch(()=>{}); this.incrementViews(r); }
  displayNormalVideo(reel){ document.getElementById('feed-container').innerHTML=this.renderVideoCard(reel); this.setupCardEventListeners(); }
  displayFullscreenVideo(reel){ document.getElementById('feed-container').innerHTML=`<div class="fullscreen-video-container"><video class="video-player fullscreen-video" src="${reel.videoUrl}" playsinline autoplay muted loop></video><div class="fullscreen-actions"><button class="fullscreen-action-btn like-btn ${this.likedReels.has(reel.$id)?'liked':''}" data-reel-id="${reel.$id}">❤️</button><button class="fullscreen-action-btn exit-btn">✕</button></div></div>`; this.setupFullscreenEventListeners(); }
  renderVideoCard(reel){ const liked=this.likedReels.has(reel.$id); const c=this.getCreator(reel); return `<div class="video-card"><video class="video-player" src="${reel.videoUrl}" loop playsinline></video><div class="action-buttons"><button class="action-btn like-btn ${liked?'liked':''}" data-reel-id="${reel.$id}">❤️<span class="action-count">${reel.likes||0}</span></button><button class="action-btn comment-btn" data-reel-id="${reel.$id}">💬</button><button class="action-btn share-btn" data-reel-id="${reel.$id}">↗️</button></div></div>`; }
  setupCardEventListeners(){ document.querySelector('.like-btn')?.addEventListener('click',e=>this.toggleLike(e.currentTarget.dataset.reelId)); document.querySelector('.comment-btn')?.addEventListener('click',e=>this.openComments(e.currentTarget.dataset.reelId)); document.querySelector('.share-btn')?.addEventListener('click',e=>this.shareVideo(e.currentTarget.dataset.reelId)); }
  setupFullscreenEventListeners(){ document.querySelector('.like-btn')?.addEventListener('click',e=>this.toggleLike(e.currentTarget.dataset.reelId)); document.querySelector('.exit-btn')?.addEventListener('click',()=>this.exitFullscreen()); }
  enterFullscreen(){ this.isFullscreen=true; this.displayCurrentVideo(); }
  exitFullscreen(){ this.isFullscreen=false; this.displayCurrentVideo(); }
  incrementViews(reel){ setTimeout(async()=>{try{await db.update(APPWRITE_CONFIG.COLLECTIONS.REELS,reel.$id,{views:(reel.views||0)+1});}catch{}},3000); }

  // FIXED LIKE WITH userId
  async toggleLike(reelId) {
    if (!session.isLoggedIn()) { window.location.href='./login.html'; return; }
    const btn = document.querySelector(`.like-btn[data-reel-id="${reelId}"]`);
    const isLiked = this.likedReels.has(reelId);
    const userId = session.getUserId();
    const countEl = btn?.querySelector('.action-count');
    const count = parseInt(countEl?.textContent||'0');

    try {
      if (isLiked) {
        this.likedReels.delete(reelId); btn?.classList.remove('liked'); if(countEl)countEl.textContent=Math.max(0,count-1);
        const likes = await db.list(APPWRITE_CONFIG.COLLECTIONS.LIKES, [Query.equal('userId',userId),Query.equal('reelId',reelId),Query.limit(1)]);
        if(likes.documents.length) await db.remove(APPWRITE_CONFIG.COLLECTIONS.LIKES, likes.documents[0].$id);
      } else {
        this.likedReels.add(reelId); btn?.classList.add('liked'); if(countEl)countEl.textContent=count+1;
        await db.create(APPWRITE_CONFIG.COLLECTIONS.LIKES, {
          likeId: ID.unique(),
          userId: userId, // REQUIRED
          reelId: reelId,
          creatorId: this.currentVideo.creatorId, // video owner
          createdAt: new Date().toISOString()
        }, null, [Permission.read(Role.any()), Permission.delete(Role.user(userId))]);
      }
    } catch(e){ console.error(e); Toast.error('Like failed'); }
  }

  async openComments(){} async loadComments(){} async postComment(){} shareVideo(){} openSearch(){} closeSearch(){} handleSearchInput(){} async searchReels(){} playFromSearch(){} handleNavClick(){} async loadTrending(){} showEmptyState(){} showLoginPrompt(){}
}
window.feedManager = new FeedManager();