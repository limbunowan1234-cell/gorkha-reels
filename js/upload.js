/**
 * GorkhaReels - Upload with ON-SCREEN debug logging
 * Logs to dlog() (visible on page) AND console (for when console works)
 */

function log(msg, type) {
  console.log(msg);
  if (window.dlog) window.dlog(msg, type);
}
function logErr(msg) {
  console.error(msg);
  if (window.dlog) window.dlog('❌ ' + msg, 'error');
}
function logWarn(msg) {
  console.warn(msg);
  if (window.dlog) window.dlog('⚠️ ' + msg, 'warn');
}

class SimpleUpload {
  constructor() {
    log('🚀 SimpleUpload constructor running');
    this.selectedFile = null;
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
      log('✅ Upload ready - tap the button to select a video');
    } catch(err) {
      logErr('Init failed: ' + err.message);
      if (window.Toast) Toast.error('Init failed: ' + err.message);
    }
  }

  setupUI() {
    const input = document.getElementById('video-file-input');
    const dropzone = document.getElementById('dropzone');
    const chooseBtn = document.getElementById('choose-btn');

    log('🔧 input found: ' + !!input + ', dropzone found: ' + !!dropzone + ', button found: ' + !!chooseBtn);

    const openPicker = (source) => {
      log('👆 ' + source + ' tapped — calling input.click()');
      try {
        input.click();
        log('✅ input.click() executed without throwing');
      } catch(e) {
        logErr('input.click() threw: ' + e.message);
      }
    };

    // Bind to BOTH the dropzone and the button, separately,
    // to maximize chance one of them works correctly on this device
    dropzone.addEventListener('click', (e) => {
      // avoid double fire if button inside was clicked too
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
      log('📁 files present: ' + (files ? files.length : 'null'));
      if (files && files[0]) {
        const f = files[0];
        log('📁 name=' + f.name + ' type=' + f.type + ' size=' + (f.size/1024/1024).toFixed(2) + 'MB');
        this.selectVideo(f);
      } else {
        logWarn('change fired but no file present (user may have cancelled)');
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
      log('✅ this.selectedFile set');

      let blobUrl;
      try {
        blobUrl = URL.createObjectURL(file);
        log('✅ Blob URL created OK');
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
      log('✅ Switched UI to details step');

      preview.addEventListener('error', () => {
        const err = preview.error;
        logErr('<video> failed to load. code=' + (err ? err.code : '?') + ' message=' + (err ? err.message : '?'));
      });
      preview.addEventListener('loadedmetadata', () => {
        log('✅ Video preview loaded OK, duration=' + preview.duration.toFixed(1) + 's');
      });

      preview.src = blobUrl;
      log('✅ preview.src assigned');

      document.getElementById('change-video-btn').onclick = () => {
        stepPick.style.display = 'flex';
        stepDetails.style.display = 'none';
        this.selectedFile = null;
        log('🔄 Reset to pick step');
      };

      log('🎉 selectVideo() completed — you should see the preview now');

    } catch(err) {
      logErr('selectVideo() crashed: ' + err.message);
      if (window.Toast) Toast.error('Error: ' + err.message);
    }
  }

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
          if (percent % 20 === 0) log('Upload progress: ' + percent + '%');
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 201) {
          resolve(`${BUNNY_CONFIG.PULL_ZONE_URL}${fileName}`);
        } else {
          reject(new Error('Upload status: ' + xhr.status));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

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
      const fileName = `${session.getUserId()}_${Date.now()}_${this.selectedFile.name}`;
      postBtn.textContent = '📹 Uploading video...';
      const videoUrl = await this.uploadWithProgress(this.selectedFile, fileName, postBtn);
      log('✅ Video uploaded: ' + videoUrl);

      postBtn.textContent = '⏳ Saving...';
      const reelId = ID.unique();
      await db.create(APPWRITE_CONFIG.COLLECTIONS.REELS, {
        reelId,
        creatorId: session.getUserId(),
        videoUrl,
        thumbnail: videoUrl,
        title,
        description: document.getElementById('post-description').value.trim() || '',
        category: document.getElementById('post-category').value || 'other',
        language: document.getElementById('post-language').value || 'Nepali',
        hashtags: '',
        views: 0, likes: 0, comments: 0, shares: 0, duration: 0,
        creatorName: session.currentUser?.name || 'Creator',
        creatorProfilePic: session.currentUser?.prefs?.avatar || '',
        isMonetised: false, adRevenue: 0,
        uploadedAt: new Date().toISOString(),
        isDeleted: false
      }, reelId);

      log('✅ Reel saved to database!');
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
