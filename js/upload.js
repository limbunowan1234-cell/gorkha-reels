/**
 * GorkhaReels - Upload with Hashtag Support
 */

function log(msg, type) {
  console.log(msg);
}
function logErr(msg) {
  console.error(msg);
}
function logWarn(msg) {
  console.warn(msg);
}

class SimpleUpload {
  constructor() {
    log('🚀 SimpleUpload constructor running');
    this.selectedFile = null;
    this.selectedHashtags = new Set(); // Track user-selected hashtags
    this.init();
  }

  async init() {
    try {
      log('🔄 Refreshing session...');
      await session.refresh();

      if (!session.isLoggedIn()) {
        logWarn('Not logged in, redirecting to login');
        window.location.href = './login.html';
        return;
      }

      log('✅ User logged in');
      this.setupUI();
      log('✅ Upload ready');
    } catch(err) {
      logErr('Init failed: ' + err.message);
      if (window.Toast) Toast.error('Init failed: ' + err.message);
    }
  }

  setupUI() {
    const input = document.getElementById('video-file-input');
    const dropzone = document.getElementById('dropzone');
    const chooseBtn = document.getElementById('choose-btn');

    const openPicker = (source) => {
      log('👆 ' + source + ' tapped — calling input.click()');
      try {
        input.click();
      } catch(e) {
        logErr('input.click() threw: ' + e.message);
      }
    };

    dropzone.addEventListener('click', (e) => {
      if (e.target === chooseBtn) return;
      openPicker('Dropzone');
    });

    chooseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openPicker('Choose button');
    });

    input.addEventListener('change', (e) => {
      log('🔔 CHANGE event fired on file input');
      const files = e.target.files;
      if (files && files[0]) {
        const f = files[0];
        log('📁 name=' + f.name + ' type=' + f.type + ' size=' + (f.size/1024/1024).toFixed(2) + 'MB');
        this.selectVideo(f);
      } else {
        logWarn('change fired but no file present (user cancelled)');
      }
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer.files?.[0]) {
        log('📥 File dropped');
        this.selectVideo(e.dataTransfer.files[0]);
      }
    });

    log('✅ All UI listeners attached');
  }

  selectVideo(file) {
    log('🎬 selectVideo() running for: ' + file.name);

    try {
      if (!file.type.startsWith('video/')) {
        logWarn('Rejected — not a video MIME type: ' + file.type);
        Toast.error('Select a video file');
        return;
      }

      if (file.size > 500 * 1024 * 1024) {
        logWarn('Rejected — file too large: ' + file.size);
        Toast.error('Max 500MB');
        return;
      }

      this.selectedFile = file;

      let blobUrl;
      try {
        blobUrl = URL.createObjectURL(file);
      } catch(e) {
        logErr('createObjectURL threw: ' + e.message);
        Toast.error('Cannot read this video file');
        return;
      }

      const stepPick = document.getElementById('step-pick');
      const stepDetails = document.getElementById('step-details');
      const preview = document.getElementById('video-preview');

      stepPick.style.display = 'none';
      stepDetails.style.display = 'flex';

      preview.addEventListener('error', () => {
        const err = preview.error;
        logErr('<video> failed to load');
      });
      preview.addEventListener('loadedmetadata', () => {
        log('✅ Video preview loaded OK, duration=' + preview.duration.toFixed(1) + 's');
      });

      preview.src = blobUrl;

      document.getElementById('change-video-btn').onclick = () => {
        stepPick.style.display = 'flex';
        stepDetails.style.display = 'none';
        this.selectedFile = null;
        this.selectedHashtags.clear();
        log('🔄 Reset to pick step');
      };

      log('🎉 selectVideo() completed');

    } catch(err) {
      logErr('selectVideo() crashed: ' + err.message);
      if (window.Toast) Toast.error('Error: ' + err.message);
    }
  }

  extractThumbnail(file, seekTime = 1) {
    return new Promise((resolve) => {
      log('🖼️ Extracting thumbnail at ' + seekTime + 's...');
      let done = false;
      const finish = (result, reason) => {
        if (done) return;
        done = true;
        if (result) log('✅ Thumbnail frame captured');
        else logWarn('Thumbnail extraction skipped: ' + reason);
        resolve(result);
      };

      const safetyTimer = setTimeout(() => finish(null, 'timeout after 8s'), 8000);

      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const url = URL.createObjectURL(file);
      const cleanup = () => { try { URL.revokeObjectURL(url); } catch(e){} };

      video.onloadedmetadata = () => {
        try {
          const target = Math.min(seekTime, (video.duration || 2) / 2 || 0.1);
          video.currentTime = target;
        } catch(e) {
          clearTimeout(safetyTimer);
          cleanup();
          finish(null, 'seek threw: ' + e.message);
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
            clearTimeout(safetyTimer);
            cleanup();
            finish(blob, blob ? null : 'toBlob returned null');
          }, 'image/jpeg', 0.85);
        } catch(e) {
          clearTimeout(safetyTimer);
          cleanup();
          finish(null, 'canvas draw threw: ' + e.message);
        }
      };

      video.onerror = () => {
        clearTimeout(safetyTimer);
        cleanup();
        finish(null, 'video element error');
      };

      video.src = url;
    });
  }

  uploadFileToBunny(file, fileName, statusBtn, label) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const startTime = Date.now();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && statusBtn) {
          const percent = Math.round((e.loaded / e.total) * 100);
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = e.loaded / elapsed;
          const remaining = (e.total - e.loaded) / rate;
          const mins = Math.floor(remaining / 60);
          const secs = Math.floor(remaining % 60);
          statusBtn.textContent = `${label} ${percent}% (${mins}m ${secs}s)`;
          if (percent % 20 === 0) log(label + ' progress: ' + percent + '%');
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 201) {
          resolve(`${BUNNY_CONFIG.PULL_ZONE_URL}${fileName}`);
        } else {
          reject(new Error(label + ' upload status: ' + xhr.status));
        }
      });

      xhr.addEventListener('error', () => reject(new Error(label + ' network error')));
      xhr.addEventListener('abort', () => reject(new Error(label + ' cancelled')));

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
      log('🚀 Post started');

      // 1️⃣ UPLOAD VIDEO
      const fileName = `${session.getUserId()}_${Date.now()}_${this.selectedFile.name}`;
      postBtn.textContent = '📹 Uploading video...';
      const videoUrl = await this.uploadFileToBunny(this.selectedFile, fileName, postBtn, '📹');
      log('✅ Video uploaded: ' + videoUrl);

      // 2️⃣ EXTRACT + UPLOAD THUMBNAIL
      let thumbnailUrl = videoUrl;
      postBtn.textContent = '🖼️ Creating thumbnail...';
      try {
        const thumbBlob = await this.extractThumbnail(this.selectedFile, 1);
        if (thumbBlob) {
          const thumbFileName = `thumb_${session.getUserId()}_${Date.now()}.jpg`;
          const uploadedThumbUrl = await this.uploadFileToBunny(thumbBlob, thumbFileName, postBtn, '🖼️');
          thumbnailUrl = uploadedThumbUrl;
          log('✅ Thumbnail uploaded: ' + thumbnailUrl);
        } else {
          logWarn('No thumbnail blob produced, using video URL as fallback');
        }
      } catch (thumbErr) {
        logWarn('Thumbnail step failed (non-blocking): ' + thumbErr.message);
      }

      // 3️⃣ SAVE TO DATABASE
      postBtn.textContent = '⏳ Saving...';
      const reelId = ID.unique();
      
      // Format hashtags: join selected hashtags, remove duplicates, save as comma-separated
      const hashtagsString = Array.from(this.selectedHashtags).join(',');
      
      await db.create(APPWRITE_CONFIG.COLLECTIONS.REELS, {
        reelId,
        creatorId: session.getUserId(),
        videoUrl,
        thumbnail: thumbnailUrl,
        title,
        description: document.getElementById('post-description').value.trim() || '',
        category: document.getElementById('post-category').value || 'other',
        language: document.getElementById('post-language').value || 'Nepali',
        hastags: hashtagsString, // IMPORTANT: field name has typo "hastags"
        views: 0, likes: 0, comments: 0, shares: 0, duration: 0,
        creatorName: session.currentUser?.name || 'Creator',
        creatorProfilePic: session.currentUser?.prefs?.avatar || '',
        isMonetised: false, adRevenue: 0,
        uploadedAt: new Date().toISOString(),
        isDeleted: false
      }, reelId);

      log('✅ Reel saved to database with hashtags: ' + hashtagsString);
      Toast.success('🎉 Reel posted!');
      setTimeout(() => { window.location.href = './creator-dashboard.html'; }, 1500);

    } catch(err) {
      logErr('Post failed: ' + err.message);
      Toast.error('Failed: ' + err.message);
      postBtn.disabled = false;
      postBtn.textContent = '🚀 Post Reel';
    }
  }
}

log('📦 Upload script file loaded');
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', () => { window.uploader = new SimpleUpload(); })
  : (window.uploader = new SimpleUpload());
