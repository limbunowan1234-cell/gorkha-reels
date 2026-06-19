/**
 * GorkhaReels - Simple Upload (Instagram-style)
 * Flow: Pick Video → Add Details → Post
 *
 * THUMBNAILS: A real JPEG is generated from the video frame at upload time
 * (while the file is still local — no CORS), uploaded to Bunny alongside the
 * video, and its URL saved into the `thumbnail` field. Display pages just read
 * reel.thumbnail — no canvas, no CORS, instant.
 */

class SimpleUpload {
  constructor() {
    console.log('🏗️ Creating SimpleUpload instance...');
    this.selectedFile = null;
    this.blobUrl = null;
    this.videoDuration = 0;
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

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      console.log('📱 Device type:', isMobile ? 'Mobile' : 'Desktop');

      const triggerFilePicker = () => {
        console.log('Opening file picker...');
        try {
          input.style.display = 'block';
          input.style.opacity = '0.01';
          input.style.position = 'absolute';
          input.style.top = '0';
          input.style.left = '0';
          input.style.width = '100%';
          input.style.height = '100%';
          input.style.zIndex = '9999';

          input.click();

          setTimeout(() => {
            input.style.display = 'none';
          }, 100);
        } catch(e) {
          console.warn('⚠️ Click failed:', e.message);
          input.style.display = 'block';
          input.style.opacity = '1';
          input.style.position = 'static';
          input.style.width = '100%';
          input.style.height = '100%';
          input.style.zIndex = '9999';
        }
      };

      dropzone.onclick = triggerFilePicker;
      dropzone.ontouchstart = (e) => {
        console.log('📱 Touch detected on dropzone');
      };
      dropzone.ontouchend = (e) => {
        e.preventDefault();
        triggerFilePicker();
      };

      const selectBtn = dropzone.querySelector('.select-btn');
      if (selectBtn) {
        selectBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          triggerFilePicker();
        };
      }

      if (!isMobile) {
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
      }

      input.addEventListener('change', (e) => {
        console.log('📹 File input changed, files:', e.target.files.length);
        if (e.target.files && e.target.files[0]) {
          input.style.display = 'none';
          this.handleFile(e.target.files[0]);
        }
      }, { passive: false });

      console.log('✅ Pick step ready (Mobile: ' + isMobile + ')');
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

      this.videoDuration = Math.floor(video.duration);
      console.log('✅ Video duration stored:', this.videoDuration);

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

  // ===== THUMBNAIL GENERATION (from LOCAL file — no CORS) =====
  // Returns a JPEG Blob of a frame, or null if it can't be produced.
  generateThumbnailBlob(file, seekTime = 1) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (result) => { if (!settled) { settled = true; resolve(result); } };

      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const url = URL.createObjectURL(file);
      const cleanup = () => { try { URL.revokeObjectURL(url); } catch(e){} };

      // Safety timeout so a stuck decode never blocks the upload
      const timer = setTimeout(() => { cleanup(); done(null); }, 8000);

      video.onloadedmetadata = () => {
        const safeSeek = Math.min(seekTime, (video.duration || 2) / 2 || 0.1);
        try { video.currentTime = safeSeek; } catch(e) { clearTimeout(timer); cleanup(); done(null); }
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 720;
          canvas.height = video.videoHeight || 1280;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            clearTimeout(timer);
            cleanup();
            done(blob); // null if the browser couldn't encode
          }, 'image/jpeg', 0.7);
        } catch(e) {
          clearTimeout(timer);
          cleanup();
          done(null);
        }
      };

      video.onerror = () => { clearTimeout(timer); cleanup(); done(null); };

      video.src = url;
    });
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

      // 1) Upload the video to Bunny
      const fileName = `${session.getUserId()}_${Date.now()}_${this.selectedFile.name}`;
      console.log('📤 Uploading video to Bunny:', fileName);
      const uploadResult = await bunny.uploadVideo(this.selectedFile, fileName);
      console.log('✅ Video uploaded:', uploadResult.url);

      // 2) Generate a real thumbnail from the LOCAL file and upload it
      //    (local file = no CORS). Falls back to '' so display pages can
      //    show the placeholder if anything goes wrong.
      let thumbnailUrl = '';
      try {
        postBtn.textContent = '🖼️ Making thumbnail...';
        const thumbBlob = await this.generateThumbnailBlob(this.selectedFile, 1);
        if (thumbBlob) {
          const thumbName = `thumb_${session.getUserId()}_${Date.now()}.jpg`;
          const thumbResult = await bunny.uploadVideo(thumbBlob, thumbName);
          thumbnailUrl = thumbResult.url;
          console.log('✅ Thumbnail uploaded:', thumbnailUrl);
        } else {
          console.warn('⚠️ Thumbnail blob was null — saving without thumbnail');
        }
      } catch (thumbErr) {
        console.warn('⚠️ Thumbnail step failed:', thumbErr.message);
      }

      postBtn.textContent = '⏳ Posting...';

      // 3) Save to Appwrite
      const reelId = ID.unique();

      const reelData = {
        // === IDENTIFIERS ===
        reelId: reelId,
        creatorId: session.getUserId(),

        // === VIDEO METADATA ===
        videoUrl: uploadResult.url,
        thumbnail: thumbnailUrl,           // ← real image URL (or '' → placeholder)
        title: title,
        description: document.getElementById('post-description').value.trim() || '',

        // === CATEGORIZATION ===
        category: document.getElementById('post-category').value || 'other',
        language: document.getElementById('post-language').value || 'Nepali',
        hashtags: '',

        // === ENGAGEMENT METRICS ===
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,

        // === VIDEO PROPERTIES ===
        duration: this.videoDuration,

        // === CREATOR INFO ===
        creatorName: session.currentUser?.name || 'Anonymous',
        creatorProfilePic: session.currentUser?.prefs?.avatar || '',

        // === MONETIZATION ===
        isMonetised: false,
        adRevenue: 0,

        // === SYSTEM FLAGS ===
        uploadedAt: new Date().toISOString(),
        isDeleted: false
      };

      console.log('💾 Saving to Appwrite with reelId:', reelId);

      const result = await db.create(APPWRITE_CONFIG.COLLECTIONS.REELS, reelData, reelId);
      console.log('✅ Saved successfully:', result.$id);

      Toast.success('Reel posted! 🎉');
      setTimeout(() => {
        window.location.href = './creator-dashboard.html';
      }, 1500);

    } catch(err) {
      console.error('❌ Post error:', err);
      console.error('📌 Error details:', {
        name: err.name,
        message: err.message,
        code: err.code,
        type: err.type
      });
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
