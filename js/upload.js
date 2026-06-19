/**
 * GorkhaReels - Simple Upload (Instagram-style)
 * 2 steps: Pick Video → Add Details → Post
 * Uses: bunny (from appwrite-config.js), session, db, Toast
 */

class SimpleUpload {
  constructor() {
    this.selectedFile = null;
    this.blobUrl = null;
    this.uploadRetries = 0;
    this.maxRetries = 3;
    this.init();
  }

  async init() {
    try {
      console.log('🔄 Refreshing session...');
      await session.refresh();
      console.log('✅ Session refreshed');
      
      if (!session.isLoggedIn()) {
        console.warn('❌ Not logged in, redirecting...');
        window.location.href = './login.html';
        return;
      }
      
      console.log('✅ User logged in');
      this.showPickStep();
      console.log('✅ Upload ready');
    } catch(err) {
      console.error('❌ Init failed:', err);
      Toast.error(`Init failed: ${err.message}`);
    }
  }

  // ===== STEP 1: PICK VIDEO =====
  showPickStep() {
    document.getElementById('step-pick').style.display = 'flex';
    document.getElementById('step-details').style.display = 'none';
    document.getElementById('upload-header-title').textContent = 'New Reel';

    const input = document.getElementById('video-file-input');
    const dropzone = document.getElementById('dropzone');

    dropzone.onclick = () => input.click();
    dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); };
    dropzone.ondragleave = () => dropzone.classList.remove('drag-over');
    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) this.handleFile(e.dataTransfer.files[0]);
    };
    input.onchange = (e) => { if (e.target.files[0]) this.handleFile(e.target.files[0]); };
  }

  handleFile(file) {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mpeg'];
    if (!allowed.includes(file.type)) { Toast.error('Use MP4, WebM or MOV'); return; }
    if (file.size > 500 * 1024 * 1024) { Toast.error('Max 500MB'); return; }

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      if (video.duration > 120) {
        const m = Math.floor(video.duration / 60), s = Math.floor(video.duration % 60);
        Toast.error(`Video is ${m}:${s} — max 2 minutes`);
        return;
      }
      this.selectedFile = file;
      this.blobUrl = URL.createObjectURL(file);
      this.showDetailsStep();
    };
    video.onerror = () => Toast.error('Invalid video file');
    video.src = URL.createObjectURL(file);
  }

  // ===== STEP 2: DETAILS =====
  showDetailsStep() {
    document.getElementById('step-pick').style.display = 'none';
    document.getElementById('step-details').style.display = 'flex';
    document.getElementById('upload-header-title').textContent = 'Add Details';

    const preview = document.getElementById('video-preview');
    preview.src = this.blobUrl;
    preview.play().catch(() => {});

    document.getElementById('change-video-btn').onclick = () => {
      preview.pause();
      this.selectedFile = null;
      this.showPickStep();
    };
  }

  // ===== UPLOAD =====
  async post() {
    const title = document.getElementById('post-title').value.trim();
    const description = document.getElementById('post-description').value.trim();
    const category = document.getElementById('post-category').value;
    const language = document.getElementById('post-language').value;

    if (!title || title.length < 2) { Toast.error('Add a title (min 2 chars)'); return; }
    if (!this.selectedFile) { Toast.error('No video selected'); return; }

    const postBtn = document.getElementById('post-btn');
    postBtn.disabled = true;

    try {
      // Upload video to Bunny CDN
      postBtn.textContent = '⏳ Uploading...';
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2,9)}_${this.selectedFile.name.replace(/[^a-zA-Z0-9._-]/g,'_').toLowerCase().substring(0,80)}`;

      let uploadResult = null;
      this.uploadRetries = 0;

      while (this.uploadRetries < this.maxRetries && !uploadResult) {
        try {
          // Use bunny client from appwrite-config.js
          uploadResult = await bunny.uploadVideo(this.selectedFile, fileName);
          console.log('✅ Video uploaded:', uploadResult);
        } catch (err) {
          this.uploadRetries++;
          console.error(`Upload attempt ${this.uploadRetries} failed:`, err);
          if (this.uploadRetries < this.maxRetries) {
            postBtn.textContent = `⏳ Retry ${this.uploadRetries}/${this.maxRetries}...`;
            await new Promise(r => setTimeout(r, 2000));
          } else throw err;
        }
      }

      if (!uploadResult) throw new Error('Failed to upload video');

      // Get creator info
      postBtn.textContent = '⏳ Saving...';
      const user = session.getUser();
      let creatorName = user.name || 'GorkhaReels Creator';
      let creatorProfilePic = '';
      try {
        const profile = await db.get(APPWRITE_CONFIG.COLLECTIONS.CREATORS, user.$id);
        creatorName = profile.name || creatorName;
        creatorProfilePic = profile.profilePic || '';
      } catch (e) {
        console.warn('Creator profile not found');
      }

      // Save to database
      const reelData = {
        reelId: ID.unique(),
        creatorId: user.$id,
        creatorName,
        creatorProfilePic,
        videoUrl: uploadResult.url,
        thumbnail: uploadResult.url,
        title,
        description: description || '',
        category: category || 'other',
        language: language || 'Nepali',
        uploadedAt: new Date().toISOString(),
        isDeleted: false,
        likes: 0,
        views: 0,
        comments: 0,
        shares: 0
      };

      console.log('📝 Saving reel:', reelData);
      await db.create(APPWRITE_CONFIG.COLLECTIONS.REELS, reelData);

      Toast.success('🎉 Reel posted!');
      setTimeout(() => window.location.href = './creator-dashboard.html', 1200);

    } catch (error) {
      console.error('Upload failed:', error);
      Toast.error(`Upload failed: ${error.message}`);
      postBtn.disabled = false;
      postBtn.textContent = '🚀 Post Reel';
    }
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { window.uploader = new SimpleUpload(); });
} else {
  window.uploader = new SimpleUpload();
}

console.log('✅ Upload Manager Ready');
