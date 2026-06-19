/**
 * GorkhaReels - Professional Video Editor
 * Instagram/YouTube Shorts style with Trim, Filters, Text, Speed, Rotate, Music
 * Optional editing - users can skip all tools
 */

class VideoEditor {
  constructor() {
    console.log('🎬 Initializing VideoEditor...');
    
    this.videoFile = null;
    this.videoDuration = 0;
    this.currentTool = 'trim';
    this.isEffectLive = true;
    
    // Trim
    this.trimStart = 0;
    this.trimEnd = 0;
    
    // Filters
    this.filters = {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      preset: null
    };
    
    // Text
    this.textElements = [];
    this.currentTextPosition = 'middle-center';
    
    // Speed
    this.speed = 1.0;
    
    // Rotation
    this.rotation = 0;
    this.flipH = false;
    this.flipV = false;
    
    // Music
    this.selectedMusic = null;
    
    this.init();
  }

  async init() {
    try {
      console.log('🔄 Loading video from localStorage...');
      
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

      video.addEventListener('loadedmetadata', () => {
        this.videoDuration = Math.floor(video.duration);
        this.trimEnd = this.videoDuration;
        
        console.log('✅ Video ready:', this.videoDuration, 'seconds');
        this.updateTrimDisplay();
      });

      console.log('✅ Editor ready');
    } catch (err) {
      console.error('❌ Init error:', err);
    }
  }

  // ===== TOOL SWITCHING =====
  switchTool(toolName) {
    this.currentTool = toolName;
    
    // Hide all tools
    document.querySelectorAll('.tool-content').forEach(el => {
      el.classList.remove('active');
    });
    
    // Hide all tabs
    document.querySelectorAll('.tool-tab').forEach(el => {
      el.classList.remove('active');
    });
    
    // Show selected
    document.getElementById(`tool-${toolName}`).classList.add('active');
    document.querySelector(`[onclick="editor.switchTool('${toolName}')"]`).classList.add('active');
  }

  // ===== TRIM TOOL =====
  updateTrimPreview() {
    const slider = document.getElementById('trim-slider');
    const percent = slider.value / 100;
    
    const duration = this.videoDuration;
    const time = percent * duration;
    
    // Simple trim: show from trim start
    const video = document.getElementById('preview-video');
    video.currentTime = this.trimStart + time;
    
    this.updateTrimDisplay();
  }

  quickTrim(seconds) {
    this.trimStart = 0;
    this.trimEnd = Math.min(seconds, this.videoDuration);
    document.getElementById('trim-slider').value = 0;
    this.updateTrimDisplay();
  }

  updateTrimDisplay() {
    const display = document.getElementById('trim-display');
    display.textContent = `${this.formatTime(this.trimStart)} - ${this.formatTime(this.trimEnd)}`;
  }

  // ===== FILTERS =====
  applyFilters() {
    const brightness = document.getElementById('brightness-slider').value;
    const contrast = document.getElementById('contrast-slider').value;
    const saturation = document.getElementById('saturation-slider').value;
    
    this.filters.brightness = brightness;
    this.filters.contrast = contrast;
    this.filters.saturation = saturation;
    
    document.getElementById('brightness-value').textContent = brightness + '%';
    document.getElementById('contrast-value').textContent = contrast + '%';
    document.getElementById('saturation-value').textContent = saturation + '%';
    
    this.renderLivePreview();
  }

  applyPreset(name) {
    this.filters.preset = name;
    
    // Reset sliders
    document.getElementById('brightness-slider').value = 100;
    document.getElementById('contrast-slider').value = 100;
    document.getElementById('saturation-slider').value = 100;
    
    switch(name) {
      case 'sepia':
        this.filters.brightness = 110;
        this.filters.contrast = 120;
        this.filters.saturation = 80;
        break;
      case 'grayscale':
        this.filters.saturation = 0;
        break;
      case 'blur':
        // Blur handled in renderLivePreview
        break;
      case 'invert':
        // Invert handled in renderLivePreview
        break;
    }
    
    this.applyFilters();
  }

  // ===== TEXT TOOL =====
  setTextPosition(position) {
    this.currentTextPosition = position;
    document.querySelectorAll('.position-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
  }

  addText() {
    const textInput = document.getElementById('text-input');
    const text = textInput.value.trim();
    
    if (!text) {
      alert('Please enter text');
      return;
    }
    
    this.textElements.push({
      text: text,
      position: this.currentTextPosition,
      id: Date.now()
    });
    
    textInput.value = '';
    this.renderTextList();
    this.renderLivePreview();
  }

  renderTextList() {
    const list = document.getElementById('text-list');
    list.innerHTML = this.textElements.map(t => `
      <div style="padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between;">
        <span>"${t.text.substring(0, 30)}..."</span>
        <button style="background: rgba(220,38,38,0.2); border: none; color: #dc2626; padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer;" onclick="editor.removeText(${t.id})">Remove</button>
      </div>
    `).join('');
  }

  removeText(id) {
    this.textElements = this.textElements.filter(t => t.id !== id);
    this.renderTextList();
    this.renderLivePreview();
  }

  // ===== SPEED =====
  updateSpeed() {
    const speed = document.getElementById('speed-slider').value;
    document.getElementById('speed-value').textContent = speed + 'x';
    this.speed = parseFloat(speed);
    
    const video = document.getElementById('preview-video');
    video.playbackRate = this.speed;
  }

  setSpeed(speed) {
    document.getElementById('speed-slider').value = speed;
    this.updateSpeed();
  }

  // ===== ROTATE/FLIP =====
  rotate(degrees) {
    this.rotation = (this.rotation + degrees) % 360;
    this.renderLivePreview();
  }

  flip(direction) {
    if (direction === 'horizontal') {
      this.flipH = !this.flipH;
    } else {
      this.flipV = !this.flipV;
    }
    this.renderLivePreview();
  }

  reset() {
    if (confirm('Reset all edits?')) {
      this.rotation = 0;
      this.flipH = false;
      this.flipV = false;
      this.filters = { brightness: 100, contrast: 100, saturation: 100, preset: null };
      this.textElements = [];
      this.trimStart = 0;
      this.trimEnd = this.videoDuration;
      document.getElementById('brightness-slider').value = 100;
      document.getElementById('contrast-slider').value = 100;
      document.getElementById('saturation-slider').value = 100;
      this.renderTextList();
      this.renderLivePreview();
    }
  }

  // ===== MUSIC =====
  openMusicLibrary() {
    localStorage.setItem('editorStep', '2');
    localStorage.setItem('returnFrom', 'editor');
    window.location.href = './music-library.html?return=editor';
  }

  removeMusic() {
    this.selectedMusic = null;
    localStorage.removeItem('selectedMusic');
    document.getElementById('music-selected').classList.remove('show');
  }

  // ===== LIVE PREVIEW =====
  toggleEffects() {
    this.isEffectLive = !this.isEffectLive;
    const btn = document.getElementById('btn-toggle-effects');
    
    if (this.isEffectLive) {
      btn.classList.add('active');
      this.renderLivePreview();
    } else {
      btn.classList.remove('active');
      const canvas = document.getElementById('preview-canvas');
      canvas.style.display = 'none';
    }
  }

  renderLivePreview() {
    if (!this.isEffectLive) return;
    
    const video = document.getElementById('preview-video');
    const canvas = document.getElementById('preview-canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.style.display = 'block';
    
    // Draw video with transforms
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.scale(this.flipH ? -1 : 1, this.flipV ? -1 : 1);
    ctx.drawImage(video, -canvas.width / 2, -canvas.height / 2);
    ctx.restore();
    
    // Apply filters
    this.applyCanvasFilters(ctx, canvas);
    
    // Draw text
    this.drawCanvasText(ctx, canvas);
    
    requestAnimationFrame(() => this.renderLivePreview());
  }

  applyCanvasFilters(ctx, canvas) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    const brightness = this.filters.brightness / 100;
    const contrast = (this.filters.contrast - 100) / 100;
    const saturation = this.filters.saturation / 100;
    
    for (let i = 0; i < data.length; i += 4) {
      // Brightness
      data[i] = Math.min(255, data[i] * brightness);
      data[i + 1] = Math.min(255, data[i + 1] * brightness);
      data[i + 2] = Math.min(255, data[i + 2] * brightness);
      
      // Contrast
      data[i] = Math.min(255, data[i] + (data[i] - 128) * contrast);
      data[i + 1] = Math.min(255, data[i + 1] + (data[i + 1] - 128) * contrast);
      data[i + 2] = Math.min(255, data[i + 2] + (data[i + 2] - 128) * contrast);
      
      // Saturation & Presets
      if (this.filters.preset === 'grayscale') {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = data[i + 1] = data[i + 2] = gray;
      } else if (this.filters.preset === 'sepia') {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        data[i] = r * 0.393 + g * 0.769 + b * 0.189;
        data[i + 1] = r * 0.349 + g * 0.686 + b * 0.168;
        data[i + 2] = r * 0.272 + g * 0.534 + b * 0.131;
      } else if (this.filters.preset === 'invert') {
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
      } else {
        // Saturation
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const gray = r * 0.299 + g * 0.587 + b * 0.114;
        data[i] = gray + (r - gray) * saturation;
        data[i + 1] = gray + (g - gray) * saturation;
        data[i + 2] = gray + (b - gray) * saturation;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  drawCanvasText(ctx, canvas) {
    if (this.textElements.length === 0) return;
    
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    
    this.textElements.forEach((textElement, index) => {
      const posMap = {
        'top-left': { x: 40, y: 40 },
        'top-center': { x: canvas.width / 2, y: 40 },
        'top-right': { x: canvas.width - 40, y: 40 },
        'middle-left': { x: 40, y: canvas.height / 2 },
        'middle-center': { x: canvas.width / 2, y: canvas.height / 2 },
        'middle-right': { x: canvas.width - 40, y: canvas.height / 2 },
        'bottom-left': { x: 40, y: canvas.height - 40 },
        'bottom-center': { x: canvas.width / 2, y: canvas.height - 40 },
        'bottom-right': { x: canvas.width - 40, y: canvas.height - 40 }
      };
      
      const pos = posMap[textElement.position];
      ctx.strokeText(textElement.text, pos.x, pos.y + (index * 30));
      ctx.fillText(textElement.text, pos.x, pos.y + (index * 30));
    });
  }

  // ===== APPLY & CONTINUE =====
  async apply() {
    try {
      const btn = document.getElementById('apply-btn');
      btn.disabled = true;
      document.getElementById('processing').classList.add('show');
      
      console.log('💾 Saving edits...');
      
      // Save all edits to localStorage
      localStorage.setItem('videoEdits', JSON.stringify({
        trim: {
          start: this.trimStart,
          end: this.trimEnd
        },
        filters: this.filters,
        text: this.textElements,
        speed: this.speed,
        rotation: this.rotation,
        flipH: this.flipH,
        flipV: this.flipV,
        music: this.selectedMusic
      }));
      
      console.log('✅ Edits saved');
      
      // Continue to upload
      localStorage.removeItem('editorVideoData');
      window.location.href = './upload.html?edited=true';
      
    } catch (err) {
      console.error('❌ Apply error:', err);
      document.getElementById('processing').classList.remove('show');
      document.getElementById('apply-btn').disabled = false;
    }
  }

  cancel() {
    if (confirm('Discard all edits?')) {
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

// Initialize
console.log('📦 Editor script loaded');
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.editor = new VideoEditor();
  });
} else {
  window.editor = new VideoEditor();
}
