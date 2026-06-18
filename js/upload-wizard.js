/**
 * GorkhaReels - Upload Wizard (Multi-Step) (FIXED)
 * 
 * FIXES APPLIED:
 * ✅ FIX #14: Video duration validated before accepting
 * ✅ FIX #7: Large video blobs use Blob API instead of base64 localStorage
 * ✅ FIX #9: Upload failure has retry logic
 * ✅ REMOVED: musicTitle & musicUrl (empty strings causing validation error)
 */

class UploadWizard {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 4;
    this.selectedFile = null;
    this.videoMetadata = null;
    this.uploadRetries = 0;
    this.maxRetries = 3;

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

  // FIX #14: Validate video duration BEFORE accepting
  // FIX #7: Use Blob API instead of localStorage for large files
  handleVideoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!this.validateVideoFormat(file)) return;

    // FIX #14: Check duration EARLY
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const aspectRatio = video.videoWidth / video.videoHeight;

      // FIX #14: Reject videos over 2 minutes (120 seconds)
      if (duration > 120) {
        const mins = Math.floor(duration / 60);
        const secs = Math.floor(duration % 60);
        Toast.error(`⏱️ Video is ${mins}:${secs} - Max 2 minutes allowed`);
        this.selectedFile = null;
        return;
      }

      // Duration is valid, proceed
      this.selectedFile = file;
      this.videoMetadata = { duration, aspectRatio };

      // FIX #7: Store video in a more efficient way (in memory via Blob URL)
      // Don't use localStorage or btoa - just keep the File object
      const blobUrl = URL.createObjectURL(file);
      
      document.getElementById('preview-video').src = blobUrl;
      document.getElementById('step3-video').src = blobUrl;

      // Show file info
      const fileInfo = document.getElementById('file-info');
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      const mins = Math.floor(duration / 60);
      const secs = Math.floor(duration % 60);

      fileInfo.innerHTML = `
        <div style="text-align: center;">
          <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${this.sanitizeFileName(file.name)}</p>
          <p style="margin: 4px 0 0 0; font-size: 11px;">
            ${sizeMB}MB • ${mins}:${secs.toString().padStart(2,'0')} ✓
          </p>
        </div>
      `;
      fileInfo.style.display = 'block';

      // Show edit controls if needed
      if (aspectRatio > 0.65 || aspectRatio < 0.4) {
        document.getElementById('edit-controls').style.display = 'block';
      }

      Toast.success('✅ Video selected!');
    };

    video.onerror = () => {
      Toast.error('❌ Invalid video file');
      this.selectedFile = null;
    };

    video.src = URL.createObjectURL(file);
  }

  validateVideoFormat(file) {
    const maxSize = 500 * 1024 * 1024;
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mpeg'];

    if (!allowed.includes(file.type)) {
      Toast.error('📹 Use MP4, WebM, or MOV format');
      return false;
    }

    if (file.size > maxSize) {
      Toast.error('📦 Max 500MB file size');
      return false;
    }

    return true;
  }

  openVideoEditor() {
    if (!this.selectedFile) {
      Toast.error('❌ Select a video first');
      return;
    }

    // FIX #7: Store video as blob URL instead of base64
    const blobUrl = URL.createObjectURL(this.selectedFile);
    sessionStorage.setItem('videoBlobUrl', blobUrl);
    sessionStorage.setItem('wizardStep', '2');
    window.location.href = './video-editor.html';
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

  // FIX #9: Upload with retry logic
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
      // FIX #9: Generate unique filename to avoid collisions
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${this.sanitizeFileName(this.selectedFile.name)}`;
      
      // Upload with retry logic
      let uploadResult = null;
      this.uploadRetries = 0;

      while (this.uploadRetries < this.maxRetries && !uploadResult) {
        try {
          uploadResult = await bunny.uploadVideo(this.selectedFile, fileName);
          break; // Success, exit retry loop
        } catch (uploadErr) {
          this.uploadRetries++;
          console.warn(`Upload attempt ${this.uploadRetries} failed:`, uploadErr);
          
          if (this.uploadRetries < this.maxRetries) {
            // Show retry message
            btnNext.textContent = `⏳ Retrying (${this.uploadRetries}/${this.maxRetries})...`;
            // Wait 2 seconds before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            throw uploadErr; // All retries failed
          }
        }
      }

      if (!uploadResult) {
        throw new Error('Upload failed after ' + this.maxRetries + ' retries');
      }

      const user = session.getUser();

      // FIXED: Minimal fields only - counter fields causing schema mismatch
      const reelData = {
        reelId: ID.unique(),
        creatorId: user.$id,
        videoUrl: uploadResult.url,
        thumbnail: `${uploadResult.url}?thumb=1`,
        title,
        description: description || '',
        category: category || 'other',
        language: language || 'Nepali',
        uploadedAt: new Date().toISOString(),
        isDeleted: false
      };

      await db.create(APPWRITE_CONFIG.COLLECTIONS.REELS, reelData);

      Toast.success('🎉 Video uploaded successfully!');

      // Clear storage
      localStorage.removeItem('selectedMusic');
      sessionStorage.removeItem('videoBlobUrl');

      setTimeout(() => {
        window.location.href = './creator-dashboard.html';
      }, 1500);

    } catch (error) {
      console.error('Upload error:', error);
      Toast.error(`❌ Upload failed: ${error.message}`);
      btnNext.disabled = false;
      btnNext.textContent = '🚀 Upload';
      
      // FIX #9: Offer retry
      if (this.uploadRetries < this.maxRetries) {
        Toast.info('Click Upload to retry');
      }
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

console.log('✅ Upload Wizard Loaded (with duration validation & retry logic, music fields removed)');
