/**
 * INTERSTITIAL MANAGER
 * Injects trending/community/explore cards into feed every 4-6 reels
 */

class InterstitialManager {
  constructor() {
    this.types = {
      TRENDING: { emoji: '🔥', title: 'Trending in Darjeeling', color: '#ff6b35' },
      COMMUNITY: { emoji: '🧑‍🤝‍🧑', title: 'Community Stories', color: '#0B5E6B' },
      EXPLORE: { emoji: '✨', title: 'Explore Darjeeling', color: '#d4af37' }
    };
  }

  /**
   * Create interstitial HTML element
   */
  createInterstitialElement(blockType) {
    const typeData = this.types[blockType] || this.types.TRENDING;
    
    const div = document.createElement('div');
    div.className = 'feed-item interstitial-block';
    div.innerHTML = `
      <div class="interstitial-content">
        <div class="interstitial-emoji">${typeData.emoji}</div>
        <div class="interstitial-title">${typeData.title}</div>
        <div class="interstitial-cta">Explore</div>
      </div>
      <style>
        .interstitial-block {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          background: linear-gradient(135deg, rgba(11, 94, 107, 0.1) 0%, rgba(13, 115, 119, 0.1) 100%);
          border: 1px solid #2d2d2d;
          min-height: 200px;
          text-align: center;
        }
        
        .interstitial-content {
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .interstitial-block:hover .interstitial-content {
          transform: scale(1.05);
        }
        
        .interstitial-emoji {
          font-size: 48px;
          margin-bottom: 12px;
        }
        
        .interstitial-title {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 12px;
        }
        
        .interstitial-cta {
          display: inline-block;
          padding: 10px 20px;
          background: #0B5E6B;
          color: #fff;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        
        .interstitial-block:hover .interstitial-cta {
          background: #0D7377;
        }
      </style>
    `;
    
    return div;
  }

  /**
   * Inject interstitials into existing feed
   */
  injectIntoFeed(feedElement, interval = 5) {
    if (!feedElement) return;
    
    const items = feedElement.querySelectorAll('.feed-item:not(.interstitial-block)');
    
    items.forEach((item, idx) => {
      if ((idx + 1) % interval === 0 && idx < items.length - 1) {
        const blockType = this.selectRandomType();
        const interstitial = this.createInterstitialElement(blockType);
        item.after(interstitial);
      }
    });
  }

  /**
   * Select random interstitial type
   */
  selectRandomType() {
    const types = Object.keys(this.types);
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Create "Trending in Darjeeling" card with reels
   */
  createTrendingCard(reels = []) {
    const div = document.createElement('div');
    div.className = 'feed-item interstitial-trending';
    
    const reelPreviews = reels.slice(0, 3).map(reel => 
      `<img src="${reel.videoUrl}" style="width: 70px; height: 70px; border-radius: 8px; object-fit: cover; cursor: pointer;" onclick="window.location.href='./video-modal.html?reelId=${reel.$id}'" />`
    ).join('');
    
    div.innerHTML = `
      <div style="padding: 16px; border-bottom: 1px solid #1a1a1a;">
        <div style="font-size: 14px; font-weight: 700; margin-bottom: 12px;">🔥 Trending in Darjeeling</div>
        <div style="display: flex; gap: 8px; justify-content: center;">
          ${reelPreviews}
        </div>
      </div>
      <style>
        .interstitial-trending {
          background: #1a1a1a;
        }
      </style>
    `;
    
    return div;
  }

  /**
   * Create "Community" card with creators
   */
  createCommunityCard(creators = []) {
    const div = document.createElement('div');
    div.className = 'feed-item interstitial-community';
    
    const creatorPreviews = creators.slice(0, 3).map(creator => 
      `<div style="text-align: center; cursor: pointer;" onclick="window.location.href='creator-profile.html?creatorId=${creator.$id}'">
        <img src="${creator.profilePic || '/logo-suite/primary/logo-khukuri-512x512.png'}" 
             style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid #0B5E6B; margin-bottom: 6px;"
             onerror="this.src='/logo-suite/primary/logo-khukuri-512x512.png'" />
        <div style="font-size: 11px; font-weight: 600; color: #aaa;">${creator.name?.substring(0, 10) || 'User'}...</div>
      </div>`
    ).join('');
    
    div.innerHTML = `
      <div style="padding: 16px; border-bottom: 1px solid #1a1a1a;">
        <div style="font-size: 14px; font-weight: 700; margin-bottom: 12px;">🧑‍🤝‍🧑 Community Stories</div>
        <div style="display: flex; gap: 16px; justify-content: center;">
          ${creatorPreviews}
        </div>
      </div>
      <style>
        .interstitial-community {
          background: #1a1a1a;
        }
      </style>
    `;
    
    return div;
  }
}

// Export
window.InterstitialManager = InterstitialManager;
