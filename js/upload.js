/**
 * GorkhaReels - FAST Upload (Skip validation & thumbnails for MVP)
 */

class SimpleUpload {
  constructor() {
    console.log('🚀 SimpleUpload loaded');
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

    console.log('✅ Upload ready');
  }

  selectVideo(file) {
    console.log('📹 Selected:', file.name);

    // Basic check
    if (!file.type.startsWith('video/')) {
      Toast.error('Select a video file');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      Toast.error('Max 500MB');
      return;
    }

    // QUICK: No validation, just show preview
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

    Toast.success('✅ Video selected');
  }

  uploadWithProgress(file, fileName) {
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

          document.getElementById('post-btn').textContent = 
            `📹 ${percent}% (${mins}m ${secs}s)`;
          console.log(`${percent}% - ${(rate/1024/1024).toFixed(2)}MB/s`);
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
      console.log('🚀 Uploading...');
      
      // Upload video
      const fileName = `${session.getUserId()}_${Date.now()}_${this.selectedFile.name}`;
      const videoUrl = await this.uploadWithProgress(this.selectedFile, fileName);
      console.log('✅ Video uploaded');

      postBtn.textContent = '⏳ Saving...';

      // Save to DB
      const reelId = ID.unique();
      await db.create(APPWRITE_CONFIG.COLLECTIONS.REELS, {
        reelId,
        creatorId: session.getUserId(),
        videoUrl,
        thumbnail: videoUrl, // Use video URL as placeholder (show real thumb later)
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

console.log('Upload script ready');
document.readyState === 'loading' 
  ? document.addEventListener('DOMContentLoaded', () => { window.uploader = new SimpleUpload(); })
  : (window.uploader = new SimpleUpload());
