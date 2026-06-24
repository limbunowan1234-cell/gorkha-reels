/**
 * GorkhaReels - Trending Algorithm
 * 
 * Scoring Formula:
 * score = (engagement_velocity × 0.40) + (views_growth × 0.30) + (recency × 0.20) + (creator_influence × 0.10)
 * 
 * - engagement_velocity: (likes + comments) / time_since_upload (per hour)
 * - views_growth: views / time_since_upload (per hour)
 * - recency: 1 - (hours_ago / 168) for last 7 days, then decays
 * - creator_influence: followers / 100 (normalized)
 */

class TrendingCalculator {
  /**
   * Calculate trending score for a reel
   * @param {Object} reel - Reel document from REELS collection
   * @param {Object} creator - Creator document from CREATORS collection
   * @returns {number} Trending score (0-100)
   */
  static calculateScore(reel, creator) {
    const now = new Date();
    const uploadTime = new Date(reel.uploadedAt || now);
    const hoursAgo = (now - uploadTime) / (1000 * 60 * 60);

    if (hoursAgo < 0.1) return 0; // Too new, not enough data

    // 1. Engagement Velocity (40% weight)
    const likes = reel.likes || 0;
    const comments = reel.comments || 0;
    const totalEngagement = likes + comments;
    const engagementVelocity = Math.max(0, totalEngagement / (hoursAgo + 0.5)); // +0.5 to avoid division by tiny numbers
    const engagementScore = Math.min(20, engagementVelocity * 2); // Cap at 20

    // 2. Views Growth (30% weight)
    const views = reel.views || 0;
    const viewsVelocity = views / (hoursAgo + 0.5);
    const viewsScore = Math.min(15, viewsVelocity / 10); // Cap at 15

    // 3. Recency (20% weight)
    let recencyScore = 0;
    if (hoursAgo <= 24) {
      recencyScore = 20; // Full score for < 24 hours
    } else if (hoursAgo <= 168) {
      // Decay from 20 to 10 over 7 days
      recencyScore = 20 - ((hoursAgo - 24) / 144 * 10);
    } else {
      recencyScore = Math.max(2, 10 - ((hoursAgo - 168) / 168 * 8)); // Slowly decay after 7 days
    }

    // 4. Creator Influence (10% weight)
    const creatorFollowers = creator?.followers || 0;
    const influenceScore = Math.min(10, creatorFollowers / 50); // 500 followers = max score

    // Total Score (weighted)
    const totalScore = 
      (engagementScore * 0.40) +
      (viewsScore * 0.30) +
      (recencyScore * 0.20) +
      (influenceScore * 0.10);

    return Math.round(totalScore);
  }

  /**
   * Get trending reels
   * @param {Array} reels - All reels from database
   * @param {Array} creators - All creators from database
   * @param {number} limit - Max reels to return (default: 50)
   * @returns {Array} Sorted trending reels with scores
   */
  static getTrendingReels(reels, creators, limit = 50) {
    const creatorMap = {};
    creators.forEach(c => { creatorMap[c.$id] = c; });

    const scored = reels
      .filter(r => r.creatorId && r.uploadedAt) // Valid reels only
      .map(r => ({
        ...r,
        trendingScore: this.calculateScore(r, creatorMap[r.creatorId])
      }))
      .filter(r => r.trendingScore > 0) // Must have positive score
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit);

    return scored;
  }

  /**
   * Check if reel is "hot" (trending)
   * @param {Object} reel - Reel document
   * @param {Object} creator - Creator document
   * @returns {boolean} True if trending
   */
  static isHot(reel, creator) {
    const score = this.calculateScore(reel, creator);
    return score >= 50; // Hot if score >= 50
  }

  /**
   * Get badge label based on score
   * @param {number} score - Trending score
   * @returns {string} Badge label
   */
  static getBadge(score) {
    if (score >= 80) return '🔥🔥 Viral';
    if (score >= 60) return '🔥 Trending';
    if (score >= 50) return '⭐ Hot';
    return '';
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrendingCalculator;
}
