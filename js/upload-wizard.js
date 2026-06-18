/**
 * GorkhaReels - Upload Wizard (Multi-Step)
 */

class UploadWizard {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 4;
    this.selectedFile = null;
    this.videoMetadata = null;

    this.init();
  }

  async init() {
    await session.refresh();
    if (!session.isLoggedIn()) {
      window.location.href = './login.html';
      return;
    }

    this.setupEventListeners();
    this.checkReturnFromMusic();
    this.updateUI();
  }

  setupEventListeners() {
    const dropZone = document.getElementById('video-drop-zone');
    const videoInput = document.getElementById('video-input');

    dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
    dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    dropZone.addEventListener('drop', (e) => this.handleDrop(e));
    dropZone.addEventListener('click', () => videoInput.click());

    videoInput.addEventListener('change', (e) => this.handleVideoSelect(e));
  }

  handleDragOver(e) {
    e.preventDefault();
    document.getElementById('video-drop-zone').classList.add('dragover');
  }

  handleDragLeave(e) {
    e.preventDefault();
    document.getElementById('video-drop-zone').classList.remove('dragover');
  }

  handleDrop(e) {
    e.preventDefault();
    document.getElementById('video-drop-zone').classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      this.handleVideoSelect({ target: { files: e.dataTransfer.files } });
    }
  }

  handleVideoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!this.validateVideoFormat(file)) return;

    this.selectedFile = file;

    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const aspectRatio = video.videoWidth / video.videoHeight;

      this.videoMetadata = { duration, aspectRatio };

      // Show preview in step 1
      const reader = new FileReader();
      reader.onload = (evt) => {
        document.getElementById('preview-video').src = evt.target.result;
        document.getElementById('step3-video').src = evt.target.result;
      };
      reader.readAsDataURL(file);

      // Show file info
      const fileInfo = document.getElementById('file-info');
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      const mins = Math.floor(duration / 60);
      const secs = Math.floor(duration % 60);

      fileInfo.innerHTML = `
        <div style="text-align: center;">
          <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${file.name}</p>
          <p style="margin: 4px 0 0 0; font-size: 11px;">
            ${sizeMB}MB • ${mins}:${secs.toString().padStart(2,'0')}
          </p>
        </div>
      `;
      fileInfo.style.display = 'block';

      // Show edit controls in step 2
      if (duration > 120 || aspectRatio > 0.65 || aspectRatio < 0.4) {
        document.getElementById('edit-controls').style.display = 'block';
      }

      Toast.success('✅ Video selected!');
    };

    video.onerror = () => {
      Toast.error('❌ Invalid video');
      this.selectedFile = null;
    };

    video.src = URL.createObjectURL(file);
  }

  validateVideoFormat(file) {
    const maxSize = 500 * 1024 * 1024;
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mpeg'];

    if (!allowed.includes(file.type)) {
      Toast.error('📹 Use MP4, WebM, or MOV');
      return false;
    }

    if (file.size > maxSize) {
      Toast.error('📦 Max 500MB');
      return false;
    }

    return true;
  }

  openVideoEditor() {
    if (!this.selectedFile) {
      Toast.error('❌ Select a video first');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const videoData = btoa(String.fromCharCode(...new Uint8Array(e.target.result)));
      localStorage.setItem('videoData', videoData);
      localStorage.setItem('wizardStep', '2');
      window.location.href = './video-editor.html';
    };
    reader.readAsArrayBuffer(this.selectedFile);
  }

  checkReturnFromMusic() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('music') && params.get('music') === 'done') {
      this.currentStep = 3;
      this.displaySelectedMusic();
    }
  }

  displaySelectedMusic() {
    const musicData = localStorage.getItem('selectedMusic');
    if (musicData) {
      const music = JSON.parse(musicData);
      document.getElementById('no-music').style.display = 'none';
      document.getElementById('music-selected').style.display = 'flex';
      document.getElementById('selected-music-title').textContent = music.title;
      document.getElementById('selected-music-artist').textContent = music.artist + ' • ' + music.duration;
    }
  }

  removeMusicSelection() {
    localStorage.removeItem('selectedMusic');
    document.getElementById('no-music').style.display = 'block';
    document.getElementById('music-selected').style.display = 'none';
    Toast.success('🎵 Music removed');
  }

  nextStep() {
    if (!this.validateStep(this.currentStep)) return;

    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.updateUI();
      this.scrollToTop();
    } else {
      this.submitForm();
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateUI();
      this.scrollToTop();
    }
  }

  validateStep(step) {
    switch (step) {
      case 1:
        if (!this.selectedFile) {
          Toast.error('❌ Select a video');
          return false;
        }
        return true;

      case 2:
        // Optional step - always allow
        return true;

      case 3:
        // Optional step - always allow
        return true;

      case 4:
        const title = document.getElementById('title').value.trim();
        if (!title || title.length < 3) {
          Toast.error('❌ Title must be 3+ characters');
          return false;
        }
        return true;

      default:
        return true;
    }
  }

  updateUI() {
    // Hide all steps
    document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));

    // Show current step
    document.getElementById(`step-${this.currentStep}`).classList.add('active');

    // Update header
    const titles = [
      '📹 Select Video',
      '✂️ Edit Video',
      '🎵 Add Music',
      '📝 Add Details'
    ];
    document.getElementById('wizard-title').textContent = titles[this.currentStep - 1];
    document.getElementById('wizard-progress').textContent = `Step ${this.currentStep} of ${this.totalSteps}`;

    // Update buttons
    const btnBack = document.getElementById('btn-back');
    const btnNext = document.getElementById('btn-next');
    const btnContainer = document.getElementById('wizard-buttons');

    if (this.currentStep === 1) {
      btnBack.style.display = 'none';
      btnContainer.classList.add('single');
      btnNext.textContent = 'Next →';
    } else if (this.currentStep === this.totalSteps) {
      btnBack.style.display = 'block';
      btnContainer.classList.remove('single');
      btnNext.textContent = '🚀 Upload';
    } else {
      btnBack.style.display = 'block';
      btnContainer.classList.remove('single');
      btnNext.textContent = 'Next →';
    }

    if (this.currentStep === 3) {
      this.displaySelectedMusic();
    }
  }

  async submitForm() {
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const category = document.getElementById('category').value;
    const language = document.getElementById('language').value;
    const hashtags = document.getElementById('hashtags').value.trim();

    if (!this.selectedFile || !title) {
      Toast.error('❌ Missing required fields');
      return;
    }

    const btnNext = document.getElementById('btn-next');
    btnNext.disabled = true;
    btnNext.textContent = '⏳ Uploading...';

    try {
      const fileName = `${Date.now()}_${this.sanitizeFileName(this.selectedFile.name)}`;
      const uploadResult = await bunny.uploadVideo(this.selectedFile, fileName);

      const user = session.getUser();
      const musicData = localStorage.getItem('selectedMusic');
      const music = musicData ? JSON.parse(musicData) : null;

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
        musicTitle: music?.title || '',
        musicUrl: music?.url || '',
        uploadedAt: new Date().toISOString(),
        isDeleted: false
      };

      await db.create(APPWRITE_CONFIG.COLLECTIONS.REELS, reelData);

      Toast.success('🎉 Video uploaded!');

      // Clear storage
      localStorage.removeItem('videoData');
      localStorage.removeItem('videoEdits');
      localStorage.removeItem('selectedMusic');

      setTimeout(() => {
        window.location.href = './creator-dashboard.html';
      }, 1500);

    } catch (error) {
      console.error('Upload error:', error);
      Toast.error(`❌ Upload failed: ${error.message}`);
      btnNext.disabled = false;
      btnNext.textContent = '🚀 Upload';
    }
  }

  sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase().substring(0, 100);
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.uploadManager = new UploadWizard();
  });
} else {
  window.uploadManager = new UploadWizard();
}

console.log('✅ Upload Wizard Loaded');
