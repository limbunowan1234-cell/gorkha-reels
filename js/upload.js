/**
 * GorkhaReels - Simple Upload (Instagram-style)
 * 2 steps: Pick Video → Add Details → Post
 * Uses: bunny (from appwrite-config.js), session, db, Toast
 */

class SimpleUpload {
  constructor() {
    try {
      console.log('🏗️ Creating SimpleUpload instance...');
      this.selectedFile = null;
      this.blobUrl = null;
      this.uploadRetries = 0;
      this.maxRetries = 3;
      console.log('✅ Properties initialized');
      this.init();
      console.log('✅ init() called');
    } catch(err) {
      console.error('❌ Constructor error:', err);
      console.error('Error message:', err.message);
      console.error('Stack:', err.stack);
      throw err;
    }
  }

  async init() {
    try {
      console.log('🔄 Refreshing session...');
      
      try {
        await session.refresh();
        console.log('✅ Session refreshed');
      } catch(sessionErr) {
        console.error('❌ Session refresh FAILED:', sessionErr);
        console.error('Error type:', sessionErr.constructor.name);
        console.error('Error message:', sessionErr.message);
        console.error('Error stack:', sessionErr.stack);
        throw sessionErr;
      }
      
      if (!session.isLoggedIn()) {
        console.warn('❌ Not logged in, redirecting...');
        window.location.href = './login.html';
        return;
      }
      
      console.log('✅ User logged in');
      
      try {
        this.showPickStep();
        console.log('✅ Pick step shown');
      } catch(err) {
        console.error('❌ showPickStep failed:', err);
        throw err;
      }
      
      console.log('✅ Upload ready');
    } catch(err) {
      console.error('❌ INIT FAILED:', err.message || err);
      console.error('Error type:', err.constructor.name);
      console.error('Stack:', err.stack);
      if (window.Toast) {
        Toast.error(`Init failed: ${err.message}`);
      } else {
        alert(`Init failed: ${err.message || err}`);
      }
    }
  }

  // ===== STEP 1: PICK VIDEO =====
  showPickStep() {
    try {
      console.log('📝 Setting up pick step...');
      
      const stepPick = document.getElementById('step-pick');
      const stepDetails = document.getElementById('step-details');
      
      if (!stepPick || !stepDetails) {
        throw new Error('HTML elements missing: step-pick or step-details');
      }
      
      stepPick.style.display = 'flex';
      stepDetails.style.display = 'none';
      
      const headerTitle = document.getElementById('upload-header-title');
      if (headerTitle) headerTitle.textContent = 'New Reel';

      const input = document.getElementById('video-file-input');
      const dropzone = document.getElementById('dropzone');
      
      if (!input || !dropzone) {
        throw new Error('HTML elements missing: video-file-input or dropzone');
      }

      dropzone.onclick = () => {
        console.log('Dropzone clicked');
        input.click();
      };
      
      dropzone.ondragover = (e) => { 
        e.preventDefault(); 
        dropzone.classList.add('drag-over'); 
      };
      
      dropzone.ondragleave = () => dropzone.classList.remove('drag-over');
      
      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        console.log('Files dropped:', e.dataTransfer.files.length);
        if (e.dataTransfer.files[0]) this.handleFile(e.dataTransfer.files[0]);
      };
      
      input.onchange = (e) => { 
        console.log('File selected:', e.target.files.length);
        if (e.target.files[0]) this.handleFile(e.target.files[0]); 
      };
      
      console.log('✅ Pick step setup complete');
    } catch(err) {
      console.error('❌ showPickStep error:', err.message || err);
      throw err;
    }
  }

  handleFile(file) {
    console.log('📹 Handling file:', file.name, file.size, file.type);
    
    try {
      const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mpeg'];
      if (!allowed.includes(file.type)) { 
        console.warn('❌ Invalid file type:', file.type);
        if (window.Toast) Toast.error('Use MP4, WebM or MOV');
        return; 
      }
      
      if (file.size > 500 * 1024 * 1024) { 
        console.warn('❌ File too large:', file.size);
        if (window.Toast) Toast.error('Max 500MB');
        return; 
      }

      console.log('📝 Creating video element for validation...');
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        try {
          console.log('✅ Video metadata loaded, duration:', video.duration);
          
          if (video.duration > 120) {
            const m = Math.floor(video.duration / 60), s = Math.floor(video.duration % 60);
            console.warn('❌ Video too long:', `${m}:${s}`);
            if (window.Toast) Toast.error(`Video is ${m}:${s} — max 2 minutes`);
            return;
          }
          
          console.log('✅ File validation passed, moving to details step');
          this.selectedFile = file;
          this.blobUrl = URL.createObjectURL(file);
          this.showDetailsStep();
        } catch(err) {
          console.error('❌ onloadedmetadata callback error:', err);
          throw err;
        }
      };
      
      video.onerror = (e) => {
        console.error('❌ Video element error event:', e);
        console.error('Error type:', video.error?.code, video.error?.message);
        if (window.Toast) Toast.error('Invalid video file');
      };
      
      video.onabort = () => console.warn('⚠️ Video load aborted');
      video.onstalled = () => console.warn('⚠️ Video load stalled');
      
      console.log('📝 Setting video src to blob URL...');
      try {
        const blobUrl = URL.createObjectURL(file);
        console.log('✅ Blob URL created:', blobUrl);
        video.src = blobUrl;
        console.log('✅ Video src set');
      } catch(err) {
        console.error('❌ Error setting video src:', err);
        throw err;
      }
    } catch(err) {
      console.error('❌ handleFile FATAL error:', err.message || err);
      console.error('Stack:', err.stack);
      if (window.Toast) Toast.error(`File error: ${err.message}`);
    }
  }

  // ===== STEP 2: DETAILS =====
  showDetailsStep() {
    try {
      console.log('📝 Setting up details step...');
      
      const stepPick = document.getElementById('step-pick');
      const stepDetails = document.getElementById('step-details');
      const preview = document.getElementById('video-preview');
      const changeBtn = document.getElementById('change-video-btn');
      const headerTitle = document.getElementById('upload-header-title');
      
      if (!stepPick || !stepDetails || !preview || !changeBtn) {
        throw new Error('Missing HTML elements in details step');
      }
      
      stepPick.style.display = 'none';
      stepDetails.style.display = 'flex';
      if (headerTitle) headerTitle.textContent = 'Add Details';

      preview.src = this.blobUrl;
      preview.play().catch(() => console.warn('⚠️ Autoplay blocked'));

      changeBtn.onclick = () => {
        console.log('Changing video...');
        preview.pause();
        this.selectedFile = null;
        this.showPickStep();
      };
      
      console.log('✅ Details step setup complete');
    } catch(err) {
      console.error('❌ showDetailsStep error:', err);
      Toast.error(`Details setup failed: ${err.message}`);
    }
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
console.log('📦 Starting upload initialization...');

// Global error handler
window.onerror = (message, source, lineno, colno, error) => {
  console.error('❌ GLOBAL ERROR:', message);
  console.error('Source:', source);
  console.error('Line:', lineno, 'Col:', colno);
  console.error('Error object:', error);
  return false;
};

// Unhandled promise rejection
window.onunhandledrejection = (event) => {
  console.error('❌ UNHANDLED PROMISE REJECTION:', event.reason);
  console.error('Promise:', event.promise);
};

try {
  if (document.readyState === 'loading') {
    console.log('⏳ DOM still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => { 
      console.log('📄 DOMContentLoaded fired');
      try {
        window.uploader = new SimpleUpload();
        console.log('✅ SimpleUpload instance created');
      } catch(err) {
        console.error('❌ Failed to create SimpleUpload:', err);
        console.error('Stack:', err.stack);
        throw err;
      }
    });
  } else {
    console.log('✅ DOM already loaded, initializing now...');
    window.uploader = new SimpleUpload();
    console.log('✅ SimpleUpload instance created');
  }
} catch(err) {
  console.error('❌ Global init error:', err.message || err);
  console.error('Error stack:', err.stack);
}

console.log('✅ Upload Manager Script Loaded');
