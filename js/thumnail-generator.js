/**
 * Generate Thumbnail from Video
 * Extracts first frame from video and converts to image
 */

async function generateThumbnailFromVideo(videoUrl) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;
    video.currentTime = 1; // Get frame at 1 second

    video.onloadedmetadata = () => {
      video.currentTime = 1;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        resolve(thumbnail);
      } catch (err) {
        reject(err);
      }
    };

    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };

    video.play().catch(() => {
      // Play failed, still try to draw
      video.onseeked();
    });
  });
}

/**
 * Load Image with Fallback
 * If thumbnail generation fails, use placeholder
 */
async function loadVideoThumbnail(videoUrl, fallback = 'assets/placeholder.svg') {
  try {
    const thumbnail = await generateThumbnailFromVideo(videoUrl);
    return thumbnail;
  } catch (err) {
    console.warn('Thumbnail generation failed:', err);
    return fallback;
  }
}

/**
 * Generate Thumbnails for Multiple Videos
 */
async function generateThumbnailsForVideos(videos) {
  const results = [];
  
  for (const video of videos) {
    try {
      const thumbnail = await generateThumbnailFromVideo(video.videoUrl);
      results.push({
        reelId: video.$id,
        thumbnail: thumbnail
      });
    } catch (err) {
      results.push({
        reelId: video.$id,
        thumbnail: 'assets/placeholder.svg'
      });
    }
  }
  
  return results;
}
