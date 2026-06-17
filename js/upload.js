/**
 * GorkhaReels - Video Upload Manager
 * Handles video upload to Bunny CDN and metadata to Appwrite
 */

class UploadManager {
  constructor() {
    this.selectedFile = null;
    this.uploadProgress = 0;
    this.isUploading = false;

    if (!session.isLoggedIn()) {
      this.redirectToLogin();
      return;
    }

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadUserProfile();
  }

  /**
   * Setup form event listeners
   */
  setupEventListeners() {
    // Video drop zone
    const dropZone = document.getElementById('video-drop-zone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
      dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
      dropZone.addEventListener('drop', (e) => this.handleDrop(e));
      dropZone.addEventListener('click', () => {
        const input = document.getElementById('video-input');
        if (input) input.click();
      });
    }

    // Video input change
    const videoInput = document.getElementById('video-input');
    if (videoInput) {
      videoInput.addEventListener('change', (e) => this.handleVideoSelect(e));
    }

    // Submit button
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.submitForm());
    }
  }

  /**
   * Load user profile
   */
  async loadUserProfile() {
    try {
      const user = session.getUser();
      if (!user) return;

      const creator = await appwrite.getDocument(
        APPWRITE_CONFIG.COLLECTIONS.CREATORS,
        user.userId
      );

      // Display user info
      const nameField = document.getElementById('creator-name');
      if (nameField) {
        nameField.textContent = creator.name || user.name;
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }

  /**
   * Handle drag over
   */
  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById('video-drop-zone');
    if (dropZone) {
      dropZone.classList.add('dragover');
    }
  }

  /**
   * Handle drag leave
   */
  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById('video-drop-zone');
    if (dropZone) {
      dropZone.classList.remove('dragover');
    }
  }

  /**
   * Handle drop
   */
  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById('video-drop-zone');
    if (dropZone) {
      dropZone.classList.remove('dragover');
    }

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.handleVideoSelect({ target: { files } });
    }
  }

  /**
   * Handle video selection
   */
  handleVideoSelect(e) {
    const files = e.target.files;
    if (files.length === 0) return;

    const file = files[0];

    // Validate file
    if (!this.validateVideo(file)) {
      return;
    }

    this.selectedFile = file;

    // Show preview
    const reader = new FileReader();
    reader.onload = (evt) => {
      const preview = document.getElementById('video-preview');
      if (preview) {
        preview.src = evt.target.result;
        preview.style.display = 'block';
      }

      // Show file info
      const fileInfo = document.getElementById('file-info');
      if (fileInfo) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        fileInfo.textContent = `${file.name} (${sizeMB} MB)`;
      }
    };
    reader.readAsDataURL(file);

    Toast.success('Video selected!');
  }

  /**
   * Validate video file
   */
  validateVideo(file) {
    const maxSize = 500 * 1024 * 1024; // 500MB
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];

    if (!allowedTypes.includes(file.type)) {
      Toast.error('Invalid video format. Use MP4, WebM, or MOV');
      return false;
    }

    if (file.size > maxSize) {
      Toast.error('Video must be less than 500MB');
      return false;
    }

    return true;
  }

  /**
   * Submit form and upload
   */
  async submitForm() {
    try {
      // Validate inputs
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

      // Start upload
      this.isUploading = true;
      const submitBtn = document.getElementById('submit-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading...';
      }

      // Upload video to Bunny
      const fileName = `${Date.now()}_${this.sanitizeFileName(this.selectedFile.name)}`;
      console.log('Uploading video to Bunny CDN...');
      
      const uploadResult = await bunny.uploadVideo(this.selectedFile, fileName);
      console.log('✅ Video uploaded:', uploadResult.url);

      // Generate thumbnail
      const thumbnailUrl = `${uploadResult.url}?quality=60&width=320`;

      // Create reel document in Appwrite
      const user = session.getUser();
      const reelData = {
        reelId: appwrite.generateId(),
        creatorId: user.userId,
        creatorName: user.name,
        creatorPic: user.profilePic || '',
        videoUrl: uploadResult.url,
        thumbnail: thumbnailUrl,
        title,
        description: description || '',
        hashtags: hashtags || '',
        category: category || 'other',
        language: language || 'Nepali',
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        duration: 0,
        uploadedAt: new Date().toISOString(),
        isMonetized: false,
        isDeleted: false,
        adRevenue: 0
      };

      console.log('Creating reel document...');
      const createdReel = await appwrite.createDocument(
        APPWRITE_CONFIG.COLLECTIONS.REELS,
        reelData
      );

      console.log('✅ Reel created:', createdReel.$id);

      // Update creator totalReels count
      try {
        const creator = await appwrite.getDocument(
          APPWRITE_CONFIG.COLLECTIONS.CREATORS,
          user.userId
        );

        await appwrite.updateDocument(
          APPWRITE_CONFIG.COLLECTIONS.CREATORS,
          user.userId,
          {
            totalReels: (creator.totalReels || 0) + 1
          }
        );
      } catch (error) {
        console.error('Error updating creator stats:', error);
      }

      // Success
      Toast.success('🎉 Video uploaded successfully!');
      
      // Reset form
      this.resetForm();

      // Redirect after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      Toast.error(`Upload failed: ${error.message}`);
    } finally {
      this.isUploading = false;
      const submitBtn = document.getElementById('submit-btn');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Upload Video';
      }
    }
  }

  /**
   * Sanitize file name
   */
  sanitizeFileName(name) {
    return name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .toLowerCase()
      .substring(0, 100);
  }

  /**
   * Reset form
   */
  resetForm() {
    document.getElementById('title').value = '';
    document.getElementById('description').value = '';
    document.getElementById('hashtags').value = '';
    document.getElementById('category').value = 'other';
    document.getElementById('language').value = 'Nepali';
    
    const preview = document.getElementById('video-preview');
    if (preview) {
      preview.style.display = 'none';
    }

    const fileInfo = document.getElementById('file-info');
    if (fileInfo) {
      fileInfo.textContent = '';
    }

    this.selectedFile = null;
  }

  /**
   * Redirect to login
   */
  redirectToLogin() {
    window.location.href = '/login.html';
  }
}

// Initialize upload manager when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.uploadManager = new UploadManager();
  });
} else {
  window.uploadManager = new UploadManager();
}

console.log('✅ Upload Manager Loaded');
