/**
 * Generate Thumbnail from Video
 * Extracts first frame and returns as data URL
 */
function generateThumbnailFromVideo(videoUrl) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      try {
        video.currentTime = 1; // Get frame at 1 second
      } catch (e) {
        resolve('assets/placeholder.svg');
      }
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 540;
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0);
        
        const thumbnail = canvas.toDataURL('image/jpeg', 0.6);
        resolve(thumbnail);
      } catch (e) {
        resolve('assets/placeholder.svg');
      }
    };

    video.onerror = () => {
      resolve('assets/placeholder.svg');
    };

    video.src = videoUrl;
  });
}
