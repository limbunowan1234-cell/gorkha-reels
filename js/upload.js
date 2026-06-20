/**
 * GorkhaReels - Upload with VERBOSE debug logging
 * Use this temporarily to find exactly where selection fails
 */

class SimpleUpload {
  constructor() {
    console.log('🚀 Upload v3 (debug) loaded');
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
      console.error('❌ Init failed:', err.message, err);
      Toast.error('Init failed: ' + err.message);
    }
  }

  setupUI() {
    const input = document.getElementById('video-file-input');
    const dropzone = document.getElementById('dropzone');

    console.log('🔧 input element found:', !!input);
    console.log('🔧 dropzone element found:', !!dropzone);

    dropzone.addEventListener('click', () => {
      console.log('👆 Dropzone tapped, calling input.click()');
      try {
        input.click();
        console.log('✅ input.click() did not throw');
      } catch(e) {
        console.error('❌ input.click() threw:', e.message, e);
      }
    });

    input.addEventListener('change', (e) => {
      console.log('🔔 CHANGE EVENT FIRED');
      console.log('📁 files length:', e.target.files ? e.target.files.length : 'null');
      if (e.target.files && e.target.files[0]) {
        const f = e.target.files[0];
        console.log('📁 file name:', f.name);
        console.log('📁 file type:', f.type);
        console.log('📁 file size:', f.size, 'bytes =', (f.size/1024/1024).toFixed(2), 'MB');
        this.selectVideo(f);
      } else {
        console.warn('⚠️ change fired but no files present');
      }
    });

    input.addEventListener('cancel', () => {
      console.log('🚫 User cancelled file picker');
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer.files?.[0]) this.selectVideo(e.dataTransfer.files[0]);
    });

    console.log('✅ All listeners attached');
  }

  selectVideo(file) {
    console.log('🎬 selectVideo() called with:', file.name);

    try {
      if (!file.type.startsWith('video/')) {
        console.warn('⚠️ Rejected — not a video type:', file.type);
        Toast.error('Select a video file');
        return;
      }

      if (file.size > 500 * 1024 * 1024) {
        console.warn('⚠️ Rejected — too large:', file.size);
        Toast.error('Max 500MB');
        return;
      }

      this.selectedFile = file;
      console.log('✅ selectedFile set');

      let blobUrl;
      try {
        blobUrl = URL.createObjectURL(file);
        console.log('✅ Blob URL created:', blobUrl);
      } catch(e) {
        console.error('❌ createObjectURL threw:', e.message, e);
        Toast.error('Cannot read this video file');
        return;
      }

      const stepPick = document.getElementById('step-pick');
      const stepDetails = document.getElementById('step-details');
      const preview = document.getElementById('video-preview');

      console.log('🔧 step-pick found:', !!stepPick);
      console.log('🔧 step-details found:', !!stepDetails);
      console.log('🔧 video-preview found:', !!preview);

      stepPick.style.display = 'none';
      stepDetails.style.display = 'flex';
      console.log('✅ Switched to details step');

      preview.addEventListener('error', (ev) => {
        const err = preview.error;
        console.error('❌ <video> element error. code:', err ? err.code : 'unknown', 'message:', err ? err.message : 'unknown');
      });
      preview.addEventListener('loadedmetadata', () => {
        console.log('✅ Video metadata loaded OK. duration:', preview.duration);
      });

      preview.src = blobUrl;
      console.log('✅ preview.src assigned');

      document.getElementById('change-video-btn').onclick = () => {
        stepPick.style.display = 'flex';
        stepDetails.style.display = 'none';
        this.selectedFile = null;
        console.log('🔄 Changed video, back to pick step');
      };

      console.log('🎉 selectVideo() completed successfully');

    } catch(err) {
      console.error('❌ selectVideo() threw an uncaught error:', err.message, err);
      Toast.error('Error: ' + err.message);
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
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          resolve(`${BUNNY_CONFIG.PULL_ZONE_URL}${fileName}`);
        } else {
          reject(new Error(`Upload status: ${xhr.status}`));
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
      const fileName = `${session.getUserId()}_${Date.now()}_${this.selectedFile.name}`;
      postBtn.textContent = '📹 Uploading video...';
      const videoUrl = await this.uploadWithProgress(this.selectedFile, fileName, postBtn);
      console.log('✅ Video uploaded:', videoUrl);

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

      Toast.success('🎉 Reel posted!');
      setTimeout(() => { window.location.href = './creator-dashboard.html'; }, 1500);

    } catch(err) {
      console.error('❌ Post error:', err.message, err);
      Toast.error(`Failed: ${err.message}`);
      postBtn.disabled = false;
      postBtn.textContent = '🚀 Post Reel';
    }
  }
}

console.log('📦 Debug upload script loaded');
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', () => { window.uploader = new SimpleUpload(); })
  : (window.uploader = new SimpleUpload());
