/**
 * GorkhaReels Share Preview Worker
 * Generates dynamic OpenGraph meta tags for social media sharing
 */

const APPWRITE_CONFIG = {
  endpoint: 'https://fra.cloud.appwrite.io/v1',
  projectId: 'gorkhareels', // Replace with your project ID
  apiKey: '', // Set via environment variable
  collections: {
    reels: 'REELS',
    creators: 'CREATORS'
  }
};

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      
      // Only handle /share.html requests
      if (!url.pathname.includes('share.html')) {
        return fetch(request);
      }

      const reelId = url.searchParams.get('reelId');
      if (!reelId) {
        return new Response('Missing reelId parameter', { status: 400 });
      }

      // Fetch reel data from Appwrite
      const reel = await fetchReel(reelId, env.APPWRITE_API_KEY);
      
      if (!reel || reel.isDeleted) {
        return new Response('Video not found', { status: 404 });
      }

      // Fetch creator data
      let creatorName = reel.creatorName || 'Creator';
      try {
        const creator = await fetchCreator(reel.creatorId, env.APPWRITE_API_KEY);
        if (creator) {
          creatorName = creator.name || creatorName;
        }
      } catch (e) {
        // Fallback to reel's creatorName
      }

      // Determine thumbnail
      const thumbUrl = getThumbnail(reel);
      const videoUrl = `${url.origin}/video-modal.html?reelId=${reelId}`;
      const title = reel.title || 'GorkhaReels Video';
      const description = `Watch "${title}" by ${creatorName} on GorkhaReels`;

      // Generate HTML with meta tags
      const html = generateHTML({
        title,
        description,
        thumbUrl,
        videoUrl,
        videoFile: reel.videoUrl || '',
        creatorName
      });

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        }
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }
};

async function fetchReel(reelId, apiKey) {
  const response = await fetch(
    `${APPWRITE_CONFIG.endpoint}/databases/gorkhareels/collections/${APPWRITE_CONFIG.collections.reels}/documents/${reelId}`,
    {
      headers: {
        'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
        'X-Appwrite-Key': apiKey
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch reel: ${response.status}`);
  }

  return response.json();
}

async function fetchCreator(creatorId, apiKey) {
  const response = await fetch(
    `${APPWRITE_CONFIG.endpoint}/databases/gorkhareels/collections/${APPWRITE_CONFIG.collections.creators}/documents/${creatorId}`,
    {
      headers: {
        'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
        'X-Appwrite-Key': apiKey
      }
    }
  );

  if (!response.ok) {
    return null;
  }

  return response.json();
}

function getThumbnail(reel) {
  const thumb = reel.thumbnail;
  const vid = reel.videoUrl;
  const fallback = 'https://gorkha-reels.pages.dev/logo-suite/primary/logo-khukuri-512x512.png';

  if (!thumb) return fallback;
  if (thumb === vid) return fallback;
  if (/\.(mp4|mov|webm|m4v)(\?|$)/i.test(thumb)) return fallback;
  
  // If it's a real image file, use it
  if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(thumb)) return thumb;
  
  return thumb || fallback;
}

function generateHTML(data) {
  const { title, description, thumbUrl, videoUrl, videoFile, creatorName } = data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - GorkhaReels</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#0B5E6B">
  <link rel="icon" type="image/png" href="https://gorkha-reels.pages.dev/logo-suite/favicon/logo-khukuri-32x32.png">
  
  <!-- OpenGraph Meta Tags -->
  <meta property="og:type" content="video.other">
  <meta property="og:site_name" content="GorkhaReels">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(thumbUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${escapeHtml(videoUrl)}">
  <meta property="og:video" content="${escapeHtml(videoFile)}">
  <meta property="og:video:type" content="video/mp4">
  <meta property="og:video:width" content="1080">
  <meta property="og:video:height" content="1920">
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="player">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(thumbUrl)}">
  <meta name="twitter:player" content="${escapeHtml(videoUrl)}">
  
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0f0f0f;
      color: #fff;
      font-family: system-ui;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 400px;
      text-align: center;
    }
    .preview {
      background: linear-gradient(135deg, #1a1a1a, #0d2d3a);
      border: 1px solid #2d2d2d;
      border-radius: 12px;
      padding: 16px;
      margin-top: 20px;
    }
    .thumbnail {
      width: 100%;
      aspect-ratio: 16/9;
      border-radius: 8px;
      overflow: hidden;
      background: #0f0f0f;
      margin-bottom: 12px;
    }
    .thumbnail img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    h1 {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    p {
      font-size: 13px;
      color: #aaa;
      margin-bottom: 12px;
    }
    .open-btn {
      width: 100%;
      padding: 12px;
      background: #0B5E6B;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .open-btn:active { transform: scale(0.96); }
  </style>
</head>
<body>
  <div class="container">
    <h1>GorkhaReels</h1>
    <div class="preview">
      <div class="thumbnail">
        <img src="${escapeHtml(thumbUrl)}" alt="Video thumbnail" onerror="this.src='https://gorkha-reels.pages.dev/logo-suite/primary/logo-khukuri-512x512.png'">
      </div>
      <h1>${escapeHtml(title)}</h1>
      <p>by ${escapeHtml(creatorName)}</p>
      <button class="open-btn" onclick="window.location='${escapeHtml(videoUrl)}'">Watch on GorkhaReels</button>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}
