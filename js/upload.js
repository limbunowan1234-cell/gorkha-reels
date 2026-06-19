/**
 * GorkhaReels - Simple Upload (Instagram-style)
 * 2 steps: Pick Video → Add Details → Post
 * Uses: bunny (from appwrite-config.js), session, db, Toast
 */

class SimpleUpload {
  constructor() {
    console.log('🏗️ Creating SimpleUpload instance...');
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
      console.error('❌ Init failed:', err.message);
      if (window.Toast) {
        Toast.error(`Init failed: ${err.message}`);
      }
    }
  }

  // ===== STEP 1: PICK VIDEO =====
  showPickStep() {
    try {
      const stepPick = document.getElementById('step-pick');
      const stepDetails = document.getElementById('step-details');
      const input = document.getElementById('video-file-input');
      const dropzone = document.getElementById('dropzone');
      const headerTitle = document.getElementById('upload-header-title');

      stepPick.style.display = 'flex';
      stepDetails.style.display = 'none';
      if (headerTitle) headerTitle.textContent = 'New Reel';

      // Dropzone click
      dropzone.onclick = () => {
        console.log('Dropzone clicked');
        input.click();
      };
      
      // Dropzone drag & drop
      dropzone.ondragover = (e) => { 
        e.preventDefault(); 
        dropzone.classList.add('drag-over'); 
      };
      dropzone.ondragleave = () => dropzone.classList.remove('drag-over');
      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) this.handleFile(e.dataTransfer.files[0]);
      };
      
      // File input change
      input.onchange = (e) => { 
        if (e.target.files[0]) this.handleFile(e.target.files[0]); 
      };
      
      console.log('✅ Pick step ready');
    } catch(err) {
      console.error('❌ showPickStep error:', err);
    }
  }

  // ===== FILE HANDLING =====
  handleFile(file) {
    console.log('📹 Handling file:', file.name, file.size, file.type);
    
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mpeg'];
    if (!allowed.includes(file.type)) { 
      Toast.error('Use MP4, WebM or MOV'); 
      return; 
    }
    
    if (file.size > 500 * 1024 * 1024) { 
      Toast.error('Max 500MB'); 
      return; 
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      console.log('✅ Video duration:', video.duration);
      
      if (video.duration > 120) {
        const m = Math.floor(video.duration / 60);
        Toast.error(`Video is ${m}:${Math.floor(video.duration % 60)} — max 2 minutes`);
        return;
      }
      
      console.log('✅ File validation passed');
      this.selectedFile = file;
      this.blobUrl = URL.createObjectURL(file);
      this.showDetailsStep();
    };
    
    video.onerror = () => {
      console.error('❌ Video error');
      Toast.error('Invalid video file');
    };
    
    video.src = URL.createObjectURL(file);
  }

  // ===== STEP 2: DETAILS =====
  showDetailsStep() {
    try {
      const stepPick = document.getElementById('step-pick');
      const stepDetails = document.getElementById('step-details');
      const videoPreview = document.getElementById('video-preview');
      const headerTitle = document.getElementById('upload-header-title');
      const changeBtn = document.getElementById('change-video-btn');

      stepPick.style.display = 'none';
      stepDetails.style.display = 'flex';
      if (headerTitle) headerTitle.textContent = 'Add Details';
      
      videoPreview.src = this.blobUrl;
      
      changeBtn.onclick = () => this.showPickStep();

      console.log('✅ Details step shown');
    } catch(err) {
      console.error('❌ showDetailsStep error:', err);
    }
  }

  // ===== POST VIDEO =====
  async post() {
    try {
      if (!this.selectedFile) {
        Toast.error('Select a video first');
        return;
      }

      const title = document.getElementById('post-title').value.trim();
      if (!title) {
        Toast.error('Add a title');
        return;
      }

      const postBtn = document.getElementById('post-btn');
      postBtn.disabled = true;
      postBtn.textContent = '⏳ Posting...';

      console.log('🚀 Starting upload...');

      // Upload to Bunny CDN
      const fileName = `${session.getUserId()}_${Date.now()}_${this.selectedFile.name}`;
      console.log('📤 Uploading to Bunny:', fileName);
      
      const uploadResult = await bunny.uploadVideo(this.selectedFile, fileName);
      console.log('✅ Bunny upload success:', uploadResult.url);

      // Save to Appwrite
      const reelData = {
        creatorId: session.getUserId(),
        creatorName: session.currentUser.name || 'Anonymous',
        creatorProfilePic: session.currentUser.prefs?.avatar || '',
        videoUrl: uploadResult.url,
        thumbnail: uploadResult.url,
        title: title,
        description: document.getElementById('post-description').value.trim(),
        category: document.getElementById('post-category').value,
        language: document.getElementById('post-language').value,
        uploadedAt: new Date().toISOString(),
        isDeleted: false,
        likes: 0,
        views: 0,
        comments: 0,
        shares: 0,
        hashtags: [],
        duration: 120,
        isMonetised: false,
        adRevenue: 0
      };

      console.log('💾 Saving to Appwrite...');
      const result = await db.create(APPWRITE_CONFIG.COLLECTIONS.REELS, reelData, ID.unique());
      console.log('✅ Saved:', result.$id);

      Toast.success('Reel posted! 🎉');
      setTimeout(() => {
        window.location.href = './creator-dashboard.html';
      }, 1500);

    } catch(err) {
      console.error('❌ Post error:', err);
      Toast.error(`Upload failed: ${err.message}`);
      const postBtn = document.getElementById('post-btn');
      postBtn.disabled = false;
      postBtn.textContent = '🚀 Post Reel';
    }
  }
}

// Initialize when ready
console.log('📦 Upload script loaded');
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.uploader = new SimpleUpload();
  });
} else {
  window.uploader = new SimpleUpload();
}
