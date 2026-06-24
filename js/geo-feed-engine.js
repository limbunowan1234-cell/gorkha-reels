/**
 * GEO FEED ENGINE
 * Ranks reels with Darjeeling-first priority
 * Wraps existing loadVideos() to inject geo awareness
 */

class GeoFeedEngine {
  constructor() {
    this.weights = {
      geoTag: 0.40,
      engagement: 0.25,
      recency: 0.20,
      locality: 0.15
    };
    this.context = 'FOR_YOU'; // FOR_YOU, NEAR_YOU, SCENIC, TRENDING
    this.darjeelingZones = [
      'Tiger Hill', 'Mall Road', 'Tea Gardens', 'Toy Train', 
      'Batasia Loop', 'Japanese Peace Pagoda', 'Singamari', 'Darjeeling'
    ];
  }

  /**
   * MAIN: Calculate reel score (0-100)
   */
  calculateReelScore(reel, creatorData = {}) {
    if (!reel) return 0;

    const geoScore = this.scoreGeoTagging(reel);
    const engagementScore = this.scoreEngagement(reel);
    const recencyScore = this.scoreRecency(reel);
    const localityScore = this.scoreCreatorLocality(creatorData);

    const finalScore = 
      (geoScore * this.weights.geoTag) +
      (engagementScore * this.weights.engagement) +
      (recencyScore * this.weights.recency) +
      (localityScore * this.weights.locality);

    return Math.min(finalScore, 100);
  }

  /**
   * Geo-tagging score (0-100)
   */
  scoreGeoTagging(reel) {
    try {
      if (!reel.location || !reel.location.isGeoTagged) return 0;
      
      const isDarjeeling = this.isDarjeelingLocation(reel.location.zone);
      return isDarjeeling ? 100 : 30; // Darjeeling gets 100, outside gets 30
    } catch (e) {
      return 0;
    }
  }

  /**
   * Engagement velocity score (0-100)
   * Favors recent engagement, decays over time
   */
  scoreEngagement(reel) {
    const likes = reel.likes || 0;
    const views = reel.views || 0;
    const comments = reel.comments || 0;
    
    if (views === 0) return 0;
    
    const engagementRate = ((likes + comments) / views) * 100;
    
    // Exponential decay based on upload time
    const now = new Date();
    const uploadTime = new Date(reel.uploadedAt);
    const hoursSinceUpload = (now - uploadTime) / (1000 * 60 * 60);
    
    if (hoursSinceUpload < 1) {
      return Math.min(engagementRate * 1.5, 100);
    } else if (hoursSinceUpload < 24) {
      return Math.min(engagementRate, 100);
    } else {
      const decayFactor = Math.exp(-hoursSinceUpload / 72);
      return Math.min(engagementRate * decayFactor, 100);
    }
  }

  /**
   * Recency score (0-100)
   */
  scoreRecency(reel) {
    const now = new Date();
    const uploadTime = new Date(reel.uploadedAt);
    const daysSinceUpload = (now - uploadTime) / (1000 * 60 * 60 * 24);
    
    // Fresh content at 100, old at ~20
    return Math.max(100 * Math.exp(-daysSinceUpload / 7), 20);
  }

  /**
   * Creator locality score (0-100)
   */
  scoreCreatorLocality(creatorData = {}) {
    if (!creatorData.location) return 30;
    
    const { city, state } = creatorData.location;
    
    if (city === 'Darjeeling') return 100;
    if (state === 'West Bengal' || state === 'Sikkim') return 60;
    return 30;
  }

  /**
   * Check if location is Darjeeling
   */
  isDarjeelingLocation(zone) {
    if (!zone) return false;
    const zoneStr = zone.toLowerCase();
    return this.darjeelingZones.some(z => zoneStr.includes(z.toLowerCase()));
  }

  /**
   * Switch feed context (changes ranking weights)
   */
  setContext(newContext) {
    this.context = newContext;
    
    switch (newContext) {
      case 'NEAR_YOU':
        this.weights = { geoTag: 0.60, engagement: 0.20, recency: 0.10, locality: 0.10 };
        break;
      case 'SCENIC':
        this.weights = { geoTag: 0.50, engagement: 0.15, recency: 0.15, locality: 0.20 };
        break;
      case 'TRENDING':
        this.weights = { geoTag: 0.30, engagement: 0.50, recency: 0.10, locality: 0.10 };
        break;
      default: // FOR_YOU
        this.weights = { geoTag: 0.40, engagement: 0.25, recency: 0.20, locality: 0.15 };
    }
  }

  /**
   * WRAPPER: Sort allContent by geo score
   * Used to wrap your existing loadVideos() output
   */
  rankContent(allContent, creatorMap = {}) {
    const scored = allContent.map(item => {
      const creator = creatorMap[item.data.creatorId] || {};
      const score = this.calculateReelScore(item.data, creator);
      return { ...item, geoScore: score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.geoScore - a.geoScore);

    return scored;
  }

  /**
   * Inject interstitial blocks every 4-6 reels
   */
  injectInterstitials(contentArray) {
    const result = [];
    const interval = Math.floor(Math.random() * 2) + 4; // 4-6

    contentArray.forEach((item, idx) => {
      result.push(item);
      
      if ((idx + 1) % interval === 0 && idx < contentArray.length - 1) {
        const blockType = this.selectInterstitialType();
        result.push({
          type: 'INTERSTITIAL',
          blockType,
          timestamp: new Date()
        });
      }
    });

    return result;
  }

  selectInterstitialType() {
    const types = ['TRENDING', 'COMMUNITY', 'EXPLORE'];
    return types[Math.floor(Math.random() * types.length)];
  }
}

// Export for use in index.html
window.GeoFeedEngine = GeoFeedEngine;
