/**
 * GorkhaReels - Upload with Hashtag Support
 */

function log(msg, type) {
  console.log(msg);
}
function logErr(msg) {
  console.error(msg);
}

class SimpleUpload {
  constructor() {
    log('🚀 SimpleUpload constructor running');
    this.selectedFile = null;
    this.selectedHashtags = new Set();
    this.init();
  }

  async init() {
    try {
      log('🔄 Refreshing session...');
      await session.refresh();

      if (!session.isLoggedIn()) {
        window.location.href = './login.html';
        return;
      }

      log('✅ User logged in');
      this.setupUI();
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
      const files = e.target.files;
      if (files && files[0]) {
        this.selectVideo(files[0]);
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
        this.selectVideo(e.dataTransfer.files[0]);
      }
    });
  }

  selectVideo(file) {
    try {
      if (!file.type.startsWith('video/')) {
        Toast.error('Select a video file');
        return;
      }

      if (file.size > 500 * 1024 * 1024) {
        Toast.error('Max 500MB');
        return;
      }

      this.selectedFile = file;

      const blobUrl = URL.createObjectURL(file);
      const stepPick = document.getElementById('step-pick');
      const stepDetails = document.getElementById('step-details');
      const preview = document.getElementById('video-preview');

      stepPick.style.display = 'none';
      stepDetails.style.display = 'flex';
      preview.src = blobUrl;

      document.getElementById('change-video-btn').onclick = () => {
        stepPick.style.display = 'flex';
        stepDetails.style.display = 'none';
        this.selectedFile = null;
        this.selectedHashtags.clear();
      };

    } catch(err) {
      logErr('selectVideo() crashed: ' + err.message);
      if (window.Toast) Toast.error('Error: ' + err.message);
    }
  }

  extractThumbnail(file, seekTime = 1) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (result) => {
        if (done) return;
        done = true;
        clearTimeout(safetyTimer);
        cleanup();
        // Many mobile browsers only fire metadata/seek events reliably
        // for video elements that are actually in the DOM.
        if (video.parentNode) video.parentNode.removeChild(video);
        resolve(result);
      };

      const safetyTimer = setTimeout(() => finish(null), 8000);

      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      // Off-screen but still in the DOM — fixes mobile browsers (notably iOS
      // Safari) that silently fail to fire loadedmetadata/seeked on a video
      // element that was never attached to the page.
      video.style.position = 'fixed';
      video.style.left = '-9999px';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0';
      document.body.appendChild(video);

      const url = URL.createObjectURL(file);
      const cleanup = () => { try { URL.revokeObjectURL(url); } catch(e){} };

      video.onloadedmetadata = () => {
        try {
          const dur = video.duration;
          const safeDur = (isFinite(dur) && dur > 0) ? dur : 2;
          video.currentTime = Math.min(seekTime, safeDur / 2 || 0.1);
        } catch(e) {
          finish(null);
        }
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 720;
          canvas.height = video.videoHeight || 1280;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => finish(blob), 'image/jpeg', 0.85);
        } catch(e) {
          finish(null);
        }
      };

      video.onerror = () => finish(null);

      video.src = url;
      video.load();
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
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 201) {
          resolve(`${BUNNY_CONFIG.PULL_ZONE_URL}${fileName}`);
        } else {
          reject(new Error(label + ' status: ' + xhr.status));
        }
      });

      xhr.addEventListener('error', () => reject(new Error(label + ' network error')));

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
      // Upload video
      const fileName = `${session.getUserId()}_${Date.now()}_${this.selectedFile.name}`;
      postBtn.textContent = '📹 Uploading video...';
      const videoUrl = await this.uploadFileToBunny(this.selectedFile, fileName, postBtn, '📹');

      // Extract thumbnail
      let thumbnailUrl = videoUrl;
      postBtn.textContent = '🖼️ Creating thumbnail...';
      try {
        const thumbBlob = await this.extractThumbnail(this.selectedFile, 1);
        if (thumbBlob) {
          const thumbFileName = `thumb_${session.getUserId()}_${Date.now()}.jpg`;
          thumbnailUrl = await this.uploadFileToBunny(thumbBlob, thumbFileName, postBtn, '🖼️');
        }
      } catch (thumbErr) {
        log('Thumbnail skipped, using video as fallback');
      }

      // Save to database
      postBtn.textContent = '⏳ Saving...';
      const reelId = ID.unique();
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
        hashtags: hashtagsString,
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

      log('✅ Reel posted with hashtags');
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

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', () => { window.uploader = new SimpleUpload(); })
  : (window.uploader = new SimpleUpload());
