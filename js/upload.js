/**
 * GorkhaReels - Upload with Progress Tracking
 * Shows upload speed, percentage, and estimated time remaining
 */

class SimpleUpload {
  constructor() {
    console.log('🏗️ Creating SimpleUpload instance...');
    this.selectedFile = null;
    this.blobUrl = null;
    this.videoDuration = 0;
    this.init();
  }

  async init() {
    try {
      console.log('🔄 Refreshing session...');
      await session.refresh();

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

  showPickStep() {
    try {
      const stepPick = document.getElementById('step-pick');
      const stepDetails = document.getElementById('step-details');
      const input = document.getElementById('video-file-input');
      const dropzone = document.getElementById('dropzone');

      stepPick.style.display = 'flex';
      stepDetails.style.display = 'none';

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      const triggerFilePicker = () => {
        console.log('Opening file picker...');
        try {
          input.style.display = 'block';
          input.style.opacity = '0.01';
          input.style.position = 'absolute';
          input.click();
          setTimeout(() => { input.style.display = 'none'; }, 100);
        } catch(e) {
          console.warn('⚠️ Click failed:', e.message);
          input.style.display = 'block';
          input.style.opacity = '1';
          input.style.position = 'static';
        }
      };

      dropzone.onclick = triggerFilePicker;
      
      input.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          input.style.display = 'none';
          this.handleFile(e.target.files[0]);
        }
      }, { passive: false });

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

      console.log('✅ Pick step ready');
    } catch(err) {
      console.error('❌ showPickStep error:', err);
    }
  }

  handleFile(file) {
    console.log('📹 Handling file:', file.name, (file.size / 1024 / 1024).toFixed(2) + ' MB');

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
        Toast.error(`Max 2 minutes (you: ${m}:${Math.floor(video.duration % 60)})`);
        return;
      }

      this.videoDuration = Math.floor(video.duration);
      this.selectedFile = file;
      this.blobUrl = URL.createObjectURL(file);
      this.showDetailsStep();
    };

    video.onerror = () => {
      Toast.error('Invalid video file');
    };

    video.src = URL.createObjectURL(file);
  }

  showDetailsStep() {
    try {
      const stepPick = document.getElementById('step-pick');
      const stepDetails = document.getElementById('step-details');
      const videoPreview = document.getElementById('video-preview');
      const changeBtn = document.getElementById('change-video-btn');

      stepPick.style.display = 'none';
      stepDetails.style.display = 'flex';
      videoPreview.src = this.blobUrl;
      changeBtn.onclick = () => this.showPickStep();

      console.log('✅ Details step shown');
    } catch(err) {
      console.error('❌ showDetailsStep error:', err);
    }
  }

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
            done(blob);
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

  // ===== UPLOAD WITH PROGRESS =====
  uploadVideoWithProgress(file, fileName, statusBtn) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const startTime = Date.now();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = e.loaded / elapsed;
          const remaining = (e.total - e.loaded) / rate;
          const minutes = Math.floor(remaining / 60);
          const seconds = Math.floor(remaining % 60);

          statusBtn.textContent = `📹 Uploading ${percentComplete}% (${minutes}m ${seconds}s)`;
          console.log(`Upload: ${percentComplete}% | Speed: ${(rate / 1024 / 1024).toFixed(2)} MB/s`);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          resolve({
            success: true,
            url: `${BUNNY_CONFIG.PULL_ZONE_URL}${fileName}`,
            fileName: fileName
          });
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed - network error'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      xhr.open('PUT', `${BUNNY_CONFIG.STORAGE_ENDPOINT}${BUNNY_CONFIG.STORAGE_ZONE}/${fileName}`);
      xhr.setRequestHeader('AccessKey', BUNNY_CONFIG.API_KEY);
      xhr.send(file);
    });
  }

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

      console.log('🚀 Upload started');
      console.log('📦 File:', (this.selectedFile.size / 1024 / 1024).toFixed(2) + ' MB');

      // 1) UPLOAD VIDEO WITH PROGRESS
      const fileName = `${session.getUserId()}_${Date.now()}_${this.selectedFile.name}`;
      postBtn.textContent = '📹 Uploading video...';
      
      const uploadResult = await this.uploadVideoWithProgress(this.selectedFile, fileName, postBtn);
      console.log('✅ Video uploaded:', uploadResult.url);

      // 2) GENERATE THUMBNAIL (NON-BLOCKING)
      let thumbnailUrl = '';
      postBtn.textContent = '🖼️ Processing thumbnail...';
      
      try {
        const thumbBlob = await this.generateThumbnailBlob(this.selectedFile, 1);
        if (thumbBlob) {
          const thumbName = `thumb_${session.getUserId()}_${Date.now()}.jpg`;
          const thumbResult = await bunny.uploadVideo(thumbBlob, thumbName);
          thumbnailUrl = thumbResult.url;
          console.log('✅ Thumbnail uploaded:', thumbnailUrl);
        }
      } catch (thumbErr) {
        console.warn('⚠️ Thumbnail failed (non-blocking):', thumbErr.message);
      }

      postBtn.textContent = '⏳ Saving...';

      // 3) SAVE TO APPWRITE
      const reelId = ID.unique();
      const reelData = {
        reelId: reelId,
        creatorId: session.getUserId(),
        videoUrl: uploadResult.url,
        thumbnail: thumbnailUrl,
        title: title,
        description: document.getElementById('post-description').value.trim() || '',
        category: document.getElementById('post-category').value || 'other',
        language: document.getElementById('post-language').value || 'Nepali',
        hashtags: '',
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        duration: this.videoDuration,
        creatorName: session.currentUser?.name || 'Anonymous',
        creatorProfilePic: session.currentUser?.prefs?.avatar || '',
        isMonetised: false,
        adRevenue: 0,
        uploadedAt: new Date().toISOString(),
        isDeleted: false
      };

      console.log('💾 Saving to Appwrite...');
      await db.create(APPWRITE_CONFIG.COLLECTIONS.REELS, reelData, reelId);
      console.log('✅ Saved!');

      Toast.success('Reel posted! 🎉');
      setTimeout(() => {
        window.location.href = './creator-dashboard.html';
      }, 1500);

    } catch(err) {
      console.error('❌ Post error:', err.message);
      Toast.error(`Failed: ${err.message}`);
      const postBtn = document.getElementById('post-btn');
      postBtn.disabled = false;
      postBtn.textContent = '🚀 Post Reel';
    }
  }
}

console.log('📦 Upload script loaded');
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.uploader = new SimpleUpload();
  });
} else {
  window.uploader = new SimpleUpload();
}
