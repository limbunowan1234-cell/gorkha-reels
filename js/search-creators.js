/**
 * GorkhaReels - Creator Search
 * Search and discover creators, follow/unfollow functionality
 */

class CreatorSearch {
  constructor() {
    console.log('🔍 Initializing Creator Search...');
    this.results = [];
    this.currentUser = null;
    this.searchTimeout = null;
    this.init();
  }

  async init() {
    try {
      // Get current user
      await session.refresh();
      this.currentUser = session.currentUser;
      console.log('✅ User:', this.currentUser?.name || 'Anonymous');

      // Bind search input
      const searchInput = document.getElementById('search-input');
      const clearBtn = document.getElementById('clear-btn');

      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        // Show/hide clear button
        if (query) {
          clearBtn.classList.add('show');
        } else {
          clearBtn.classList.remove('show');
        }

        // Debounce search
        clearTimeout(this.searchTimeout);
        if (query.length > 0) {
          this.searchTimeout = setTimeout(() => this.search(query), 300);
        } else {
          this.showEmpty();
        }
      });

      console.log('✅ Search ready');
    } catch (err) {
      console.error('❌ Init error:', err);
    }
  }

  async search(query) {
    try {
      if (!query || query.length < 1) {
        this.showEmpty();
        return;
      }

      console.log('🔍 Searching:', query);
      const container = document.getElementById('results-container');
      
      // Show loading
      container.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          <p>Searching creators...</p>
        </div>
      `;

      // Query Appwrite - search by name or username
      const creators = await db.list(
        APPWRITE_CONFIG.COLLECTIONS.CREATORS,
        [
          Query.or([
            Query.contains('name', query),
            Query.contains('username', query)
          ]),
          Query.orderDesc('followers'),
          Query.limit(50)
        ]
      );

      console.log('✅ Found:', creators.documents.length, 'creators');

      if (creators.documents.length === 0) {
        this.showNoResults(query);
        return;
      }

      this.results = creators.documents;
      this.displayResults();
    } catch (err) {
      console.error('❌ Search error:', err);
      const container = document.getElementById('results-container');
      container.innerHTML = `
        <div class="error-message">
          ❌ Search error: ${err.message}
        </div>
      `;
    }
  }

  displayResults() {
    try {
      const container = document.getElementById('results-container');
      
      if (this.results.length === 0) {
        this.showNoResults('');
        return;
      }

      let html = `<div class="results-section">`;
      
      this.results.forEach(creator => {
        const avatar = creator.profilePic || 'https://via.placeholder.com/48';
        const followers = this.formatNumber(creator.followers || 0);
        const videos = creator.totalReels || 0;
        const verified = creator.isVerified ? '✓' : '';
        const bio = creator.bio || 'Creator on GorkhaReels';

        html += `
          <div class="creator-card" onclick="window.searchCreators && window.searchCreators.goToCreator('${creator.$id}')">
            <div class="creator-avatar">
              <img src="${avatar}" alt="${creator.name}" onerror="this.src='https://via.placeholder.com/48'">
            </div>

            <div class="creator-info">
              <div class="creator-name-row">
                <span class="creator-name">${this.escapeHtml(creator.name)}</span>
                ${verified ? '<span class="verified-badge">✓</span>' : ''}
              </div>
              <div class="creator-username">@${this.escapeHtml(creator.username || 'user')}</div>
              <div class="creator-bio">${this.escapeHtml(bio)}</div>
              <div class="creator-stats">
                <span>👥 ${followers} followers</span>
                <span>🎬 ${videos} videos</span>
              </div>
            </div>

            <div class="creator-action">
              <button 
                class="follow-btn follow" 
                id="follow-${creator.$id}"
                onclick="event.stopPropagation(); window.searchCreators && window.searchCreators.toggleFollow('${creator.$id}', '${this.escapeHtml(creator.name)}', this)"
              >
                Follow
              </button>
            </div>
          </div>
        `;
      });

      html += `</div>`;
      container.innerHTML = html;
    } catch (err) {
      console.error('❌ Display error:', err);
    }
  }

  async toggleFollow(creatorId, creatorName, btn) {
    try {
      if (!this.currentUser) {
        alert('Please login first');
        window.location.href = './login.html';
        return;
      }

      btn.disabled = true;
      const userId = this.currentUser.$id;

      // Check if already following
      const isFollowing = btn.classList.contains('following');

      if (isFollowing) {
        // Unfollow
        await this.unfollow(userId, creatorId, btn);
      } else {
        // Follow
        await this.follow(userId, creatorId, btn);
      }
    } catch (err) {
      console.error('❌ Toggle follow error:', err);
      alert('Error: ' + err.message);
      btn.disabled = false;
    }
  }

  async follow(userId, creatorId, btn) {
    try {
      console.log('➕ Following:', creatorId);

      // Create follow relationship
      const followId = `${userId}_${creatorId}`;
      await db.create(
        APPWRITE_CONFIG.COLLECTIONS.FOLLOWERS,
        {
          followId: followId,
          followerID: userId,
          followingId: creatorId,
          CreatorId: creatorId,
          createdAt: new Date().toISOString()
        },
        followId
      );

      // Update creator followers count
      const creator = this.results.find(c => c.$id === creatorId);
      if (creator) {
        const newFollowers = (creator.followers || 0) + 1;
        await db.update(
          APPWRITE_CONFIG.COLLECTIONS.CREATORS,
          creatorId,
          { followers: newFollowers }
        );
        creator.followers = newFollowers;
      }

      // Update button
      btn.classList.remove('follow');
      btn.classList.add('following');
      btn.textContent = 'Following';
      btn.disabled = false;

      console.log('✅ Followed');
    } catch (err) {
      console.error('❌ Follow error:', err);
      throw err;
    }
  }

  async unfollow(userId, creatorId, btn) {
    try {
      console.log('➖ Unfollowing:', creatorId);

      const followId = `${userId}_${creatorId}`;
      await db.delete(
        APPWRITE_CONFIG.COLLECTIONS.FOLLOWERS,
        followId
      );

      // Update creator followers count
      const creator = this.results.find(c => c.$id === creatorId);
      if (creator) {
        const newFollowers = Math.max(0, (creator.followers || 1) - 1);
        await db.update(
          APPWRITE_CONFIG.COLLECTIONS.CREATORS,
          creatorId,
          { followers: newFollowers }
        );
        creator.followers = newFollowers;
      }

      // Update button
      btn.classList.remove('following');
      btn.classList.add('follow');
      btn.textContent = 'Follow';
      btn.disabled = false;

      console.log('✅ Unfollowed');
    } catch (err) {
      console.error('❌ Unfollow error:', err);
      throw err;
    }
  }

  goToCreator(creatorId) {
    console.log('→ Going to creator:', creatorId);
    window.location.href = `./creator-profile.html?id=${creatorId}`;
  }

  showEmpty() {
    const container = document.getElementById('results-container');
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎬</div>
        <div class="empty-state-text">Find creators</div>
        <div class="empty-state-subtext">Search for creators to follow and discover</div>
      </div>
    `;
  }

  showNoResults(query) {
    const container = document.getElementById('results-container');
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-text">No creators found</div>
        <div class="empty-state-subtext">Try searching with different keywords</div>
      </div>
    `;
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

// Initialize
console.log('📦 Search script loaded');
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.searchCreators = new CreatorSearch();
  });
} else {
  window.searchCreators = new CreatorSearch();
}
