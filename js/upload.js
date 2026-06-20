/**
 * GorkhaReels - FINAL Upload
 * Smart Auto-Thumbnail + Fast Upload
 */

class SimpleUpload {
  constructor() {
    console.log('🚀 GorkhaReels Upload v2 loaded');
    this.selectedFile = null;
    this.init();
  }

  async init() {
    try {
      await session.refresh();
      if (!session.isLoggedIn()) {
        window.location.href = './login.html';
        return;
      }
      this.setupUI();
      console.log('✅ Upload ready');
    } catch(err) {
      console.error('❌ Init:', err.message);
      Toast.error('Init failed');
    }
  }

  setupUI() {
    const input = document.getElementById('video-file-input');
    const dropzone = document.getElementById('dropzone');

    // Click to select
    dropzone.onclick = () => input.click();

    // File selected
    input.addEventListener('change', (e) => {
      if (e.target.files?.[0]) {
        this.selectVideo(e.target.files[0]);
      }
    });

    // Desktop drag-drop
    dropzone.ondragover = (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    };
    dropzone.ondragleave = () => dropzone.classList.remove('drag-over');
    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer.files?.[0]) {
        this.selectVideo(e.dataTransfer.files[0]);
      }
    };
  }

  selectVideo(file) {
    console.log('📹 Selected:', file.name, (file.size / 1024 / 1024).toFixed(2) + 'MB');

    // Basic check
    if (!file.type.startsWith('video/')) {
      Toast.error('Select a video file');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      Toast.error('Max 500MB');
      return;
    }

    // Save and show preview
    this.selectedFile = file;
    const blobUrl = URL.createObjectURL(file);
    
    document.getElementById('step-pick').style.display = 'none';
    document.getElementById('step-details').style.display = 'flex';
    document.getElementById('video-preview').src = blobUrl;
    
    document.getElementById('change-video-btn').onclick = () => {
      document.getElementById('step-pick').style.display = 'flex';
      document.getElementById('step-details').style.display = 'none';
      this.selectedFile = null;
    };

    console.log('✅ Video ready');
  }

  // ===== EXTRACT THUMBNAIL =====
  async extractThumbnail(videoFile, timestamp = 1) {
    return new Promise((resolve) => {
      console.log('🖼️ Extracting thumbnail at', timestamp + 's...');
      
      let completed = false;
      const timeout = setTimeout(() => {
        if (!completed) {
          console.warn('⚠️ Thumbnail timeout, skipping');
          completed = true;
          resolve(null);
        }
      }, 8000);

      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;

      const url = URL.createObjectURL(videoFile);

      video.onloadedmetadata = () => {
        try {
          video.currentTime = Math.min(timestamp, video.duration * 0.5);
        } catch(e) {
          clearTimeout(timeout);
          completed = true;
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 720;
          canvas.height = video.videoHeight || 1280;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          canvas.toBlob((blob) => {
            if (!completed) {
              clearTimeout(timeout);
              completed = true;
              URL.revokeObjectURL(url);
              console.log('✅ Thumbnail extracted');
              resolve(blob);
            }
          }, 'image/jpeg', 0.85);
        } catch(e) {
          clearTimeout(timeout);
          completed = true;
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };

      video.onerror = () => {
        clearTimeout(timeout);
        completed = true;
        URL.revokeObjectURL(url);
        resolve(null);
      };

      video.src = url;
    });
  }

  // ===== UPLOAD WITH PROGRESS =====
  uploadWithProgress(file, fileName, statusBtn) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const startTime = Date.now();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = e.loaded / elapsed;
          const remaining = (e.total - e.loaded) / rate;
          const mins = Math.floor(remaining / 60);
          const secs = Math.floor(remaining % 60);

          statusBtn.textContent = `📹 ${percent}% (${mins}m ${secs}s)`;
          console.log(`${percent}%`);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          resolve(`${BUNNY_CONFIG.PULL_ZONE_URL}${fileName}`);
        } else {
          reject(new Error(`Upload: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.addEventListener('abort', () => reject(new Error('Cancelled')));

      xhr.open('PUT', `${BUNNY_CONFIG.STORAGE_ENDPOINT}${BUNNY_CONFIG.STORAGE_ZONE}/${fileName}`);
      xhr.setRequestHeader('AccessKey', BUNNY_CONFIG.API_KEY);
      xhr.send(file);
    });
  }

  async post() {
    if (!this.selectedFile) {
      Toast.error('Select a video');
      return;
    }

    const title = document.getElementById('post-title').value.trim();
    if (!title) {
      Toast.error('Add a title');
      return;
    }

    const postBtn = document.getElementById('post-btn');
    postBtn.disabled = true;

    try {
      console.log('🚀 Starting upload...');
      
      // 1️⃣ UPLOAD VIDEO
      const fileName = `${session.getUserId()}_${Date.now()}_${this.selectedFile.name}`;
      postBtn.textContent = '📹 Uploading video...';
      const videoUrl = await this.uploadWithProgress(this.selectedFile, fileName, postBtn);
      console.log('✅ Video uploaded');

      // 2️⃣ EXTRACT THUMBNAIL
      let thumbnailUrl = '';
      postBtn.textContent = '🖼️ Creating thumbnail...';
      try {
        const thumbBlob = await this.extractThumbnail(this.selectedFile, 1);
        if (thumbBlob) {
          const thumbFileName = `thumb_${session.getUserId()}_${Date.now()}.jpg`;
          thumbnailUrl = await this.uploadWithProgress(thumbFileName, `thumb_${Date.now()}.jpg`, postBtn);
          
          // Actually upload the blob
          const thumbXhr = new XMLHttpRequest();
          await new Promise((resolve, reject) => {
            thumbXhr.addEventListener('load', () => {
              if (thumbXhr.status === 200) {
                thumbnailUrl = `${BUNNY_CONFIG.PULL_ZONE_URL}thumb_${Date.now()}.jpg`;
                console.log('✅ Thumbnail uploaded');
                resolve();
              } else reject();
            });
            thumbXhr.addEventListener('error', reject);
            thumbXhr.open('PUT', `${BUNNY_CONFIG.STORAGE_ENDPOINT}${BUNNY_CONFIG.STORAGE_ZONE}/thumb_${Date.now()}.jpg`);
            thumbXhr.setRequestHeader('AccessKey', BUNNY_CONFIG.API_KEY);
            thumbXhr.send(thumbBlob);
          });
        }
      } catch(err) {
        console.warn('⚠️ Thumbnail failed (non-blocking):', err.message);
        thumbnailUrl = videoUrl; // Fallback to video URL
      }

      // 3️⃣ SAVE TO DATABASE
      postBtn.textContent = '⏳ Saving...';
      const reelId = ID.unique();
      await db.create(APPWRITE_CONFIG.COLLECTIONS.REELS, {
        reelId,
        creatorId: session.getUserId(),
        videoUrl,
        thumbnail: thumbnailUrl || videoUrl,
        title,
        description: document.getElementById('post-description').value.trim() || '',
        category: document.getElementById('post-category').value || 'other',
        language: document.getElementById('post-language').value || 'Nepali',
        hashtags: '',
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        duration: 0,
        creatorName: session.currentUser?.name || 'Creator',
        creatorProfilePic: session.currentUser?.prefs?.avatar || '',
        isMonetised: false,
        adRevenue: 0,
        uploadedAt: new Date().toISOString(),
        isDeleted: false
      }, reelId);

      console.log('✅ Reel saved!');
      Toast.success('🎉 Reel posted!');
      setTimeout(() => {
        window.location.href = './creator-dashboard.html';
      }, 1500);

    } catch(err) {
      console.error('❌ Error:', err.message);
      Toast.error(`Failed: ${err.message}`);
      postBtn.disabled = false;
      postBtn.textContent = '🚀 Post Reel';
    }
  }
}

console.log('📦 Upload script loaded');
document.readyState === 'loading' 
  ? document.addEventListener('DOMContentLoaded', () => { window.uploader = new SimpleUpload(); })
  : (window.uploader = new SimpleUpload());
