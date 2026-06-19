/**
 * GorkhaReels - Professional Video Editor (Fixed)
 * Proper event binding + full functionality
 */

class VideoEditor {
  constructor() {
    console.log('🎬 Initializing VideoEditor...');
    this.videoFile = null;
    this.videoDuration = 0;
    this.currentTool = 'trim';
    this.trimStart = 0;
    this.trimEnd = 0;
    this.filters = { brightness: 100, contrast: 100, saturation: 100 };
    this.textElements = [];
    this.currentTextPosition = 'middle-center';
    this.speed = 1.0;
    this.rotation = 0;
    this.flipH = false;
    this.flipV = false;
    this.bindEvents();
    this.init();
  }

  bindEvents() {
    console.log('🔗 Binding events...');
    
    // Tool tabs
    document.getElementById('tab-trim')?.addEventListener('click', () => this.switchTool('trim'));
    document.getElementById('tab-filters')?.addEventListener('click', () => this.switchTool('filters'));
    document.getElementById('tab-text')?.addEventListener('click', () => this.switchTool('text'));
    document.getElementById('tab-speed')?.addEventListener('click', () => this.switchTool('speed'));
    document.getElementById('tab-rotate')?.addEventListener('click', () => this.switchTool('rotate'));
    document.getElementById('tab-music')?.addEventListener('click', () => this.switchTool('music'));

    // Trim
    document.getElementById('trim-slider')?.addEventListener('input', () => this.updateTrimPreview());

    // Filters
    document.getElementById('brightness-slider')?.addEventListener('input', () => this.applyFilters());
    document.getElementById('contrast-slider')?.addEventListener('input', () => this.applyFilters());

    // Speed
    document.getElementById('speed-slider')?.addEventListener('input', () => this.updateSpeed());

    // Rotate
    document.getElementById('btn-rotate')?.addEventListener('click', () => this.rotate(90));
    document.getElementById('btn-flip-h')?.addEventListener('click', () => this.flip('horizontal'));
    document.getElementById('btn-flip-v')?.addEventListener('click', () => this.flip('vertical'));
    document.getElementById('btn-reset')?.addEventListener('click', () => this.reset());

    // Text
    document.getElementById('btn-add-text')?.addEventListener('click', () => this.addText());
    document.querySelectorAll('.position-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.position-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentTextPosition = e.target.getAttribute('data-pos');
      });
    });

    // Live preview toggle
    document.getElementById('btn-toggle-effects')?.addEventListener('click', () => this.toggleEffects());

    // Actions
    document.getElementById('btn-skip')?.addEventListener('click', () => this.cancel());
    document.getElementById('btn-continue')?.addEventListener('click', () => this.apply());

    console.log('✅ Events bound');
  }

  async init() {
    try {
      console.log('💿 Loading video from localStorage...');
      const videoData = localStorage.getItem('editorVideoData');
      if (!videoData) {
        console.error('No video found');
        window.location.href = './upload.html';
        return;
      }

      const binaryString = atob(videoData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      this.videoFile = new Blob([bytes], { type: 'video/mp4' });
      const videoUrl = URL.createObjectURL(this.videoFile);
      
      const video = document.getElementById('preview-video');
      video.src = videoUrl;
      video.play().catch(e => console.warn('Autoplay blocked:', e.message));

      video.addEventListener('loadedmetadata', () => {
        this.videoDuration = Math.floor(video.duration);
        this.trimEnd = this.videoDuration;
        console.log('✅ Video ready:', this.videoDuration, 'seconds');
        this.updateTrimDisplay();
      });

      console.log('✅ Editor ready');
    } catch(err) {
      console.error('❌ Init error:', err);
    }
  }

  switchTool(toolName) {
    this.currentTool = toolName;
    
    document.querySelectorAll('.tool-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tool-tab').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`tool-${toolName}`)?.classList.add('active');
    document.getElementById(`tab-${toolName}`)?.classList.add('active');
    
    console.log('🔧 Switched to:', toolName);
  }

  // TRIM
  updateTrimPreview() {
    const slider = document.getElementById('trim-slider');
    const percent = slider.value / 100;
    const time = percent * this.videoDuration;
    
    const video = document.getElementById('preview-video');
    video.currentTime = this.trimStart + time;
    this.updateTrimDisplay();
  }

  updateTrimDisplay() {
    const display = document.getElementById('trim-display');
    display.textContent = `${this.formatTime(this.trimStart)} - ${this.formatTime(this.trimEnd)}`;
  }

  // FILTERS
  applyFilters() {
    const brightness = document.getElementById('brightness-slider').value;
    const contrast = document.getElementById('contrast-slider').value;
    
    this.filters.brightness = brightness;
    this.filters.contrast = contrast;
    
    document.getElementById('brightness-value').textContent = brightness + '%';
    document.getElementById('contrast-value').textContent = contrast + '%';
    
    console.log('🎨 Filters applied');
  }

  // SPEED
  updateSpeed() {
    const speed = document.getElementById('speed-slider').value;
    document.getElementById('speed-value').textContent = speed + 'x';
    this.speed = parseFloat(speed);
    
    const video = document.getElementById('preview-video');
    video.playbackRate = this.speed;
  }

  // ROTATE
  rotate(degrees) {
    this.rotation = (this.rotation + degrees) % 360;
    console.log('🔄 Rotated:', this.rotation);
  }

  flip(direction) {
    if (direction === 'horizontal') {
      this.flipH = !this.flipH;
    } else {
      this.flipV = !this.flipV;
    }
    console.log('🔄 Flipped:', direction, this.flipH, this.flipV);
  }

  reset() {
    if (confirm('Reset all edits?')) {
      this.rotation = 0;
      this.flipH = false;
      this.flipV = false;
      this.filters = { brightness: 100, contrast: 100, saturation: 100 };
      this.textElements = [];
      this.trimStart = 0;
      this.trimEnd = this.videoDuration;
      document.getElementById('brightness-slider').value = 100;
      document.getElementById('contrast-slider').value = 100;
      this.applyFilters();
      console.log('↩️ Reset all');
    }
  }

  // TEXT
  addText() {
    const textInput = document.getElementById('text-input');
    const text = textInput.value.trim();
    
    if (!text) {
      alert('Enter text');
      return;
    }
    
    this.textElements.push({
      text: text,
      position: this.currentTextPosition,
      id: Date.now()
    });
    
    textInput.value = '';
    console.log('📝 Text added:', text);
  }

  toggleEffects() {
    const btn = document.getElementById('btn-toggle-effects');
    btn.classList.toggle('active');
    console.log('👁️ Effects toggled');
  }

  // ACTIONS
  async apply() {
    try {
      const btn = document.getElementById('btn-continue');
      btn.disabled = true;
      btn.textContent = '⏳ Saving...';

      localStorage.setItem('videoEdits', JSON.stringify({
        trim: { start: this.trimStart, end: this.trimEnd },
        filters: this.filters,
        text: this.textElements,
        speed: this.speed,
        rotation: this.rotation,
        flipH: this.flipH,
        flipV: this.flipV
      }));

      console.log('✅ Edits saved');
      localStorage.removeItem('editorVideoData');
      window.location.href = './upload.html?edited=true';
    } catch(err) {
      console.error('❌ Error:', err);
      document.getElementById('btn-continue').disabled = false;
      document.getElementById('btn-continue').textContent = '✓ Continue';
    }
  }

  cancel() {
    if (confirm('Skip editing?')) {
      localStorage.removeItem('editorVideoData');
      window.location.href = './upload.html';
    }
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

console.log('📦 Editor script loaded');
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.editor = new VideoEditor();
  });
} else {
  window.editor = new VideoEditor();
}
