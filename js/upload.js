/**
 * GorkhaReels - Video Upload Manager (Appwrite Web SDK)
 * Uploads video to Bunny CDN, saves metadata to Appwrite
 */

class UploadManager {
  constructor() {
    this.selectedFile = null;
    this.init();
  }

  async init() {
    await session.refresh();
    if (!session.isLoggedIn()) {
      window.location.href = './login.html';
      return;
    }
    this.setupEventListeners();
    this.loadUserProfile();
  }

  setupEventListeners() {
    const dropZone = document.getElementById('video-drop-zone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
      dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
      dropZone.addEventListener('drop', (e) => this.handleDrop(e));
      dropZone.addEventListener('click', () => {
        document.getElementById('video-input')?.click();
      });
    }

    document.getElementById('video-input')?.addEventListener('change', (e) => this.handleVideoSelect(e));
    document.getElementById('submit-btn')?.addEventListener('click', () => this.submitForm());
  }

  loadUserProfile() {
    const user = session.getUser();
    const nameField = document.getElementById('creator-name');
    if (nameField && user) {
      nameField.textContent = user.name || user.email;
    }
  }

  handleDragOver(e) {
    e.preventDefault();
    document.getElementById('video-drop-zone')?.classList.add('dragover');
  }
  handleDragLeave(e) {
    e.preventDefault();
    document.getElementById('video-drop-zone')?.classList.remove('dragover');
  }
  handleDrop(e) {
    e.preventDefault();
    document.getElementById('video-drop-zone')?.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      this.handleVideoSelect({ target: { files: e.dataTransfer.files } });
    }
  }

  handleVideoSelect(e) {
    const file = e.target.files[0];
    if (!file || !this.validateVideo(file)) return;

    this.selectedFile = file;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const preview = document.getElementById('video-preview');
      if (preview) {
        preview.src = evt.target.result;
        preview.style.display = 'block';
      }
      const fileInfo = document.getElementById('file-info');
      if (fileInfo) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        fileInfo.textContent = `${file.name} (${sizeMB} MB)`;
      }
    };
    reader.readAsDataURL(file);
    Toast.success('Video selected!');
  }

  validateVideo(file) {
    const maxSize = 500 * 1024 * 1024;
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowed.includes(file.type)) {
      Toast.error('Use MP4, WebM, or MOV format');
      return false;
    }
    if (file.size > maxSize) {
      Toast.error('Video must be under 500MB');
      return false;
    }
    return true;
  }

  async submitForm() {
    const title = document.getElementById('title')?.value?.trim();
    const description = document.getElementById('description')?.value?.trim();
    const category = document.getElementById('category')?.value;
    const language = document.getElementById('language')?.value;
    const hashtags = document.getElementById('hashtags')?.value?.trim();

    if (!this.selectedFile || !title) {
      Toast.error('Please select a video and enter a title');
      return;
    }
    if (title.length < 3) {
      Toast.error('Title must be at least 3 characters');
      return;
    }

    const submitBtn = document.getElementById('submit-btn');
    const progressBar = document.getElementById('progress-bar');

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Uploading...';
      progressBar?.classList.add('active');

      // 1. Upload to Bunny CDN
      const fileName = `${Date.now()}_${this.sanitizeFileName(this.selectedFile.name)}`;
      const uploadResult = await bunny.uploadVideo(this.selectedFile, fileName);
      console.log('✅ Video uploaded:', uploadResult.url);

      // 2. Save metadata to Appwrite
      const user = session.getUser();
      const reelData = {
        reelId: ID.unique(),
        creatorId: user.$id,
        videoUrl: uploadResult.url,
        thumbnail: `${uploadResult.url}?thumb=1`,
        title,
        description: description || '',
        hastags: hashtags || '',
        category: category || 'other',
        language: language || 'Nepali',
        uploadedAt: new Date().toISOString(),
        isDeleted: false
      };

      await db.create(APPWRITE_CONFIG.COLLECTIONS.REELS, reelData);
      console.log('✅ Reel saved');

      Toast.success('🎉 Video uploaded successfully!');
      this.resetForm();

      setTimeout(() => {
        window.location.href = './index.html';
      }, 1500);

    } catch (error) {
      console.error('Upload error:', error);
      Toast.error(`Upload failed: ${error.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Upload Video';
      progressBar?.classList.remove('active');
    }
  }

  sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase().substring(0, 100);
  }

  resetForm() {
    ['title', 'description', 'hashtags'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const preview = document.getElementById('video-preview');
    if (preview) preview.style.display = 'none';
    const fileInfo = document.getElementById('file-info');
    if (fileInfo) fileInfo.textContent = '';
    this.selectedFile = null;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.uploadManager = new UploadManager();
  });
} else {
  window.uploadManager = new UploadManager();
}

console.log('✅ Upload Manager Loaded');
