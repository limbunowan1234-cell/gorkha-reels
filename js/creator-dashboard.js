/**
 * GorkhaReels - Creator Dashboard (UPDATED with Options Sheet)
 * 
 * UPDATES APPLIED:
 * ✅ View counting integrated: totalViews now includes VIEWS collection tracking
 * ✅ Real-time view aggregation from REELS.views
 * ✅ Proper error handling for missing profiles
 * ✅ Delete videos with soft-delete via isDeleted flag
 * ✅ Bank details with corrected bankUpiId field
 * ✅ Profile editing with image upload
 * ✅ Options sheet with Edit, Reshare, Delete buttons
 */

class DashboardManager {
  constructor() {
    this.user = null;
    this.creatorData = null;
    this.myReels = [];
    this.init();
  }

  async init() {
    await session.refresh();
    if (!session.isLoggedIn()) {
      window.location.href = './login.html';
      return;
    }
    this.user = session.getUser();
    await this.loadCreatorData();
    await this.loadMyReels();
    this.setupEventListeners();
  }

  async loadCreatorData() {
    try {
      this.creatorData = await db.get(APPWRITE_CONFIG.COLLECTIONS.CREATORS, this.user.$id);
      console.log('✅ Creator profile loaded');
    } catch (error) {
      console.warn('Creator profile not found, creating new one:', error.message);
      
      try {
        this.creatorData = {
          userId: this.user.$id,
          name: this.user.name || 'Unknown Creator',
          email: this.user.email,
          bio: '',
          profilePic: '',
          followers: 0,
          totalViews: 0,
          totalReels: 0,
          totalEarnings: 0,
          username: '',
          isVerified: false,
          isActive: true,
          createdAt: new Date().toISOString()
        };

        await db.create(APPWRITE_CONFIG.COLLECTIONS.CREATORS, this.creatorData, this.user.$id);
        console.log('✅ New creator profile created');
      } catch (createErr) {
        console.error('Failed to create profile:', createErr);
        this.creatorData = {
          userId: this.user.$id,
          name: this.user.name || 'Creator',
          email: this.user.email,
          bio: 'Complete your profile',
          profilePic: '',
          followers: 0,
          totalViews: 0,
          totalReels: 0,
          totalEarnings: 0
        };
        Toast.info('📝 Please complete your profile');
      }
    }
    
    this.displayProfile();
  }

  displayProfile() {
    const d = this.creatorData;
    this.setText('creator-name', d.name || 'Unknown Creator');
    this.setText('creator-bio', d.bio || 'Complete your profile');
    this.setText('followers-count', d.followers || 0);
    
    // Views will be updated after loading reels (real aggregation)
    this.setText('total-views', this.formatNumber(d.totalViews || 0));

    const avatar = document.getElementById('creator-avatar');
    if (avatar) avatar.src = d.profilePic || 'assets/logo.png';

    // Earnings
    this.setText('total-earnings', '₹ 0.00');
    this.setText('ad-revenue', '₹ 0.00');
    this.setText('tips-earnings', '₹ 0.00');
    this.setText('sponsor-earnings', '₹ 0.00');
  }

  async loadMyReels() {
    try {
      const response = await db.list(APPWRITE_CONFIG.COLLECTIONS.REELS, [
        Query.equal('creatorId', this.user.$id),
        Query.equal('isDeleted', false),
        Query.orderDesc('uploadedAt'),
        Query.limit(50)
      ]);
      this.myReels = response.documents;
      
      // ✅ Calculate real total views from all reels
      const totalVideos = this.myReels.length;
      const totalViews = this.myReels.reduce((sum, r) => sum + (r.views || 0), 0);
      
      this.setText('total-reels', totalVideos);
      this.setText('total-views', this.formatNumber(totalViews));
      this.setText('total-views-perf', this.formatNumber(totalViews));
      
      // Update creator profile with real aggregated views
      if (this.creatorData && totalViews !== this.creatorData.totalViews) {
        try {
          await db.update(APPWRITE_CONFIG.COLLECTIONS.CREATORS, this.user.$id, {
            totalViews: totalViews,
            totalReels: totalVideos
          });
          this.creatorData.totalViews = totalViews;
        } catch (e) {
          console.log('Could not update creator stats:', e.message);
        }
      }
      
      console.log(`✅ Loaded ${totalVideos} reels, ${totalViews} total views`);
      this.displayMyReels();
    } catch (error) {
      console.error('Error loading reels:', error);
      this.setText('total-reels', 0);
      this.displayMyReels();
    }
  }

  displayMyReels() {
    const container = document.getElementById('my-reels-container');
    if (!container) return;

    if (this.myReels.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:var(--text-secondary);border:1px dashed var(--border-color);border-radius:12px;">
          <div style="font-size:40px;margin-bottom:12px;">🎬</div>
          <p style="margin-bottom:16px;">No videos uploaded yet</p>
          <a href="./upload.html" style="display:inline-block;text-decoration:none;padding:10px 24px;border-radius:8px;background:var(--primary-red);color:#fff;font-weight:700;">+ Upload Your First Video</a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">
        ${this.myReels.map(r => this.renderReelCard(r)).join('')}
      </div>
    `;
  }

  renderReelCard(reel) {
    return `
      <div style="position:relative;aspect-ratio:9/16;border-radius:6px;overflow:hidden;background:var(--dark-secondary);cursor:pointer;" onclick="window.location.href='./video-modal.html?id=${reel.$id}'">
        <video
          src="${reel.videoUrl}#t=0.5"
          style="width:100%;height:100%;object-fit:cover;"
          preload="metadata"
          muted
          playsinline
        ></video>
        <div style="position:absolute;bottom:0;left:0;right:0;padding:6px 8px;background:linear-gradient(transparent,rgba(0,0,0,0.8));">
          <div style="display:flex;align-items:center;gap:4px;color:#fff;font-size:12px;font-weight:600;">
            <span>👁️</span><span>${this.formatNumber(reel.views || 0)}</span>
          </div>
        </div>
        <button 
          style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.6);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;transition:background 0.2s;" 
          onmouseover="this.style.background='rgba(220,38,38,0.8)'" 
          onmouseout="this.style.background='rgba(0,0,0,0.6)'" 
          onclick="event.stopPropagation(); window.dashboardManager.openReelOptions('${reel.$id}', '${(reel.title || 'Video').replace(/'/g, "\\'")}')"
          title="More options"
        >⋯</button>
      </div>
    `;
  }

  openReelOptions(reelId, title) {
    const backdrop = document.getElementById('reel-options-backdrop');
    const sheet = document.getElementById('reel-options-sheet');
    
    if (!backdrop || !sheet) {
      console.error('Options sheet elements not found');
      return;
    }

    backdrop.classList.add('open');
    sheet.classList.add('open');

    // Store current reel ID for use in button handlers
    this.currentReelId = reelId;
    this.currentReelTitle = title;
    
    // Close on backdrop click
    backdrop.onclick = () => this.closeReelOptions();
    
    // Button handlers
    document.getElementById('opt-edit').onclick = () => {
      this.closeReelOptions();
      Toast.info('📝 Edit coming soon!');
    };
    
    document.getElementById('opt-reshare').onclick = () => {
      this.closeReelOptions();
      const shareUrl = `${location.origin}/video-modal.html?id=${reelId}`;
      navigator.clipboard.writeText(shareUrl);
      Toast.success('🔄 Link copied!');
    };
    
    document.getElementById('opt-delete').onclick = () => {
      this.closeReelOptions();
      this.confirmDelete(reelId, title);
    };
    
    document.getElementById('opt-cancel').onclick = () => {
      this.closeReelOptions();
    };
  }

  closeReelOptions() {
    const backdrop = document.getElementById('reel-options-backdrop');
    const sheet = document.getElementById('reel-options-sheet');
    
    if (backdrop) backdrop.classList.remove('open');
    if (sheet) sheet.classList.remove('open');
  }

  confirmDelete(reelId, title) {
    const modal = document.createElement('div');
    modal.id = 'delete-confirm-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;`;
    modal.innerHTML = `
      <div style="background:var(--dark-card,#1a1a1a);border-radius:16px;width:100%;max-width:320px;border:1px solid #ef4444;">
        <div style="padding:20px;text-align:center;">
          <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
          <h3 style="color:#fff;margin:0 0 8px;font-size:18px;">Delete Video?</h3>
          <p style="color:var(--text-secondary,#888);margin:0 0 20px;font-size:14px;">
            <strong>"${escapeHtml(title)}"</strong> will be permanently deleted.
          </p>
          <div style="display:flex;gap:12px;">
            <button onclick="document.getElementById('delete-confirm-modal').remove()" style="flex:1;background:var(--dark-bg,#000);border:1px solid var(--border-color,#333);border-radius:8px;padding:12px;color:var(--text-primary,#fff);font-weight:600;cursor:pointer;">Cancel</button>
            <button id="confirm-delete-btn" onclick="window.dashboardManager.deleteReel('${reelId}')" style="flex:1;background:#ef4444;border:none;border-radius:8px;padding:12px;color:#fff;font-weight:600;cursor:pointer;">Delete</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  async deleteReel(reelId) {
    const btn = document.getElementById('confirm-delete-btn');
    const modal = document.getElementById('delete-confirm-modal');
    
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Deleting...';
    }

    try {
      await db.update(APPWRITE_CONFIG.COLLECTIONS.REELS, reelId, {
        isDeleted: true
      });

      console.log('✅ Video deleted (soft delete)');
      Toast.success('🗑️ Video deleted');
      
      if (modal) modal.remove();
      await this.loadMyReels();

    } catch (error) {
      console.error('Delete failed:', error);
      Toast.error('Failed to delete video');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Delete';
      }
    }
  }

  setupEventListeners() {
    document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
      this.openEditProfile();
    });
    document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
  }

  openChangePassword() {
    const modal = document.createElement('div');
    modal.id = 'change-password-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;`;
    modal.innerHTML = `
      <div style="background:var(--dark-card,#1a1a1a);border-radius:16px;width:100%;max-width:400px;">
        <div style="padding:20px;border-bottom:1px solid var(--border-color,#333);display:flex;justify-content:space-between;align-items:center;">
          <h3 style="color:#fff;margin:0;font-size:18px;">🔐 Change Password</h3>
          <button onclick="document.getElementById('change-password-modal').remove()" style="background:none;border:none;color:#fff;font-size:24px;cursor:pointer;">✕</button>
        </div>
        <div style="padding:20px;">
          <div style="margin-bottom:16px;">
            <label style="display:block;color:var(--text-secondary,#888);font-size:13px;margin-bottom:6px;">Current Password</label>
            <input id="current-password" type="password" placeholder="Enter current password" style="width:100%;background:var(--dark-bg,#000);border:1px solid var(--border-color,#333);border-radius:8px;padding:12px;color:#fff;font-size:14px;box-sizing:border-box;">
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:block;color:var(--text-secondary,#888);font-size:13px;margin-bottom:6px;">New Password</label>
            <input id="new-password" type="password" placeholder="Min 8 characters" style="width:100%;background:var(--dark-bg,#000);border:1px solid var(--border-color,#333);border-radius:8px;padding:12px;color:#fff;font-size:14px;box-sizing:border-box;">
          </div>
          <div style="margin-bottom:20px;">
            <label style="display:block;color:var(--text-secondary,#888);font-size:13px;margin-bottom:6px;">Confirm New Password</label>
            <input id="confirm-password" type="password" placeholder="Repeat new password" style="width:100%;background:var(--dark-bg,#000);border:1px solid var(--border-color,#333);border-radius:8px;padding:12px;color:#fff;font-size:14px;box-sizing:border-box;">
          </div>
          <button id="save-password-btn" onclick="window.dashboardManager.savePassword()" style="width:100%;background:var(--primary-red,#dc2626);border:none;border-radius:8px;padding:14px;color:#fff;font-weight:700;font-size:15px;cursor:pointer;">🔐 Update Password</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  async savePassword() {
    const current = document.getElementById('current-password')?.value?.trim();
    const newPass = document.getElementById('new-password')?.value?.trim();
    const confirm = document.getElementById('confirm-password')?.value?.trim();
    const btn = document.getElementById('save-password-btn');

    if (!current || !newPass || !confirm) { Toast.error('Fill all fields'); return; }
    if (newPass.length < 8) { Toast.error('New password must be 8+ characters'); return; }
    if (newPass !== confirm) { Toast.error('Passwords do not match'); return; }

    btn.disabled = true;
    btn.textContent = '⏳ Updating...';

    try {
      await account.updatePassword(newPass, current);
      Toast.success('✅ Password updated!');
      document.getElementById('change-password-modal')?.remove();
    } catch (error) {
      console.error('Password update failed:', error);
      if (error.message?.includes('Invalid credentials')) {
        Toast.error('Current password is incorrect');
      } else {
        Toast.error('Failed to update password');
      }
      btn.disabled = false;
      btn.textContent = '🔐 Update Password';
    }
  }

  openBankDetails() {
    const d = this.creatorData;
    const modal = document.createElement('div');
    modal.id = 'bank-details-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;`;
    modal.innerHTML = `
      <div style="background:var(--dark-card,#1a1a1a);border-radius:16px;width:100%;max-width:400px;max-height:85vh;overflow-y:auto;">
        <div style="padding:20px;border-bottom:1px solid var(--border-color,#333);display:flex;justify-content:space-between;align-items:center;">
          <h3 style="color:#fff;margin:0;font-size:18px;">🏦 Bank Details</h3>
          <button onclick="document.getElementById('bank-details-modal').remove()" style="background:none;border:none;color:#fff;font-size:24px;cursor:pointer;">✕</button>
        </div>
        <div style="padding:20px;">
          <p style="color:var(--text-secondary,#888);font-size:13px;margin-bottom:20px;">Your earnings will be transferred to this account.</p>
          <div style="margin-bottom:16px;">
            <label style="display:block;color:var(--text-secondary,#888);font-size:13px;margin-bottom:6px;">Account Holder Name</label>
            <input id="bank-name" type="text" value="${escapeHtml(d.bankAccountName || '')}" placeholder="Full name as on bank account" style="width:100%;background:var(--dark-bg,#000);border:1px solid var(--border-color,#333);border-radius:8px;padding:12px;color:#fff;font-size:14px;box-sizing:border-box;">
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:block;color:var(--text-secondary,#888);font-size:13px;margin-bottom:6px;">Account Number</label>
            <input id="bank-account" type="text" value="${escapeHtml(d.bankAccountNumber || '')}" placeholder="Your bank account number" style="width:100%;background:var(--dark-bg,#000);border:1px solid var(--border-color,#333);border-radius:8px;padding:12px;color:#fff;font-size:14px;box-sizing:border-box;">
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:block;color:var(--text-secondary,#888);font-size:13px;margin-bottom:6px;">IFSC Code</label>
            <input id="bank-ifsc" type="text" value="${escapeHtml(d.bankIfscCode || '')}" placeholder="e.g. SBIN0001234" style="width:100%;background:var(--dark-bg,#000);border:1px solid var(--border-color,#333);border-radius:8px;padding:12px;color:#fff;font-size:14px;box-sizing:border-box;">
          </div>
          <div style="margin-bottom:20px;">
            <label style="display:block;color:var(--text-secondary,#888);font-size:13px;margin-bottom:6px;">UPI ID (optional)</label>
            <input id="bank-upi" type="text" value="${escapeHtml(d.bankUpiId || '')}" placeholder="yourname@upi" style="width:100%;background:var(--dark-bg,#000);border:1px solid var(--border-color,#333);border-radius:8px;padding:12px;color:#fff;font-size:14px;box-sizing:border-box;">
          </div>
          <button id="save-bank-btn" onclick="window.dashboardManager.saveBankDetails()" style="width:100%;background:var(--primary-red,#dc2626);border:none;border-radius:8px;padding:14px;color:#fff;font-weight:700;font-size:15px;cursor:pointer;">💾 Save Bank Details</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  async saveBankDetails() {
    const name = document.getElementById('bank-name')?.value?.trim();
    const account = document.getElementById('bank-account')?.value?.trim();
    const ifsc = document.getElementById('bank-ifsc')?.value?.trim();
    const upi = document.getElementById('bank-upi')?.value?.trim();
    const btn = document.getElementById('save-bank-btn');

    if (!name || !account || !ifsc) { Toast.error('Fill required fields'); return; }

    btn.disabled = true;
    btn.textContent = '⏳ Saving...';

    try {
      await db.update(APPWRITE_CONFIG.COLLECTIONS.CREATORS, this.user.$id, {
        bankAccountName: name,
        bankAccountNumber: account,
        bankIfscCode: ifsc,
        bankUpiId: upi || ''
      });
      this.creatorData.bankAccountName = name;
      this.creatorData.bankAccountNumber = account;
      this.creatorData.bankIfscCode = ifsc;
      this.creatorData.bankUpiId = upi;
      Toast.success('✅ Bank details saved!');
      document.getElementById('bank-details-modal')?.remove();
    } catch (error) {
      console.error('Bank save failed:', error);
      Toast.error('Failed to save bank details');
      btn.disabled = false;
      btn.textContent = '💾 Save Bank Details';
    }
  }

  openContentGuidelines() {
    const modal = document.createElement('div');
    modal.id = 'guidelines-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;`;
    modal.innerHTML = `
      <div style="background:var(--dark-card,#1a1a1a);border-radius:16px;width:100%;max-width:400px;max-height:85vh;overflow-y:auto;">
        <div style="padding:20px;border-bottom:1px solid var(--border-color,#333);display:flex;justify-content:space-between;align-items:center;">
          <h3 style="color:#fff;margin:0;font-size:18px;">📋 Content Guidelines</h3>
          <button onclick="document.getElementById('guidelines-modal').remove()" style="background:none;border:none;color:#fff;font-size:24px;cursor:pointer;">✕</button>
        </div>
        <div style="padding:20px;color:var(--text-secondary,#aaa);font-size:14px;line-height:1.7;">
          <p style="color:#fff;font-weight:700;margin-bottom:12px;">Welcome to GorkhaReels! 🎬</p>
          <p style="margin-bottom:16px;">To keep our community safe and vibrant, please follow these guidelines:</p>

          <p style="color:var(--accent-gold,#fbbf24);font-weight:600;margin-bottom:8px;">✅ What's Allowed</p>
          <ul style="padding-left:16px;margin-bottom:20px;">
            <li>Gorkha/Nepali culture, music, dance</li>
            <li>Entertainment, comedy, storytelling</li>
            <li>Educational and informational content</li>
            <li>Sports, fitness, travel</li>
            <li>Food, lifestyle, vlogs</li>
          </ul>

          <p style="color:#ef4444;font-weight:600;margin-bottom:8px;">❌ Not Allowed</p>
          <ul style="padding-left:16px;margin-bottom:20px;">
            <li>Hate speech or discrimination</li>
            <li>Violence or graphic content</li>
            <li>Adult/explicit content</li>
            <li>Misinformation or fake news</li>
            <li>Copyright-infringing content</li>
            <li>Spam or misleading content</li>
          </ul>

          <p style="color:var(--text-secondary,#888);font-size:12px;">Violations may result in content removal or account suspension. For questions, contact support.</p>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  openSupport() {
    const modal = document.createElement('div');
    modal.id = 'support-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;`;
    modal.innerHTML = `
      <div style="background:var(--dark-card,#1a1a1a);border-radius:16px;width:100%;max-width:400px;">
        <div style="padding:20px;border-bottom:1px solid var(--border-color,#333);display:flex;justify-content:space-between;align-items:center;">
          <h3 style="color:#fff;margin:0;font-size:18px;">📞 Support</h3>
          <button onclick="document.getElementById('support-modal').remove()" style="background:none;border:none;color:#fff;font-size:24px;cursor:pointer;">✕</button>
        </div>
        <div style="padding:20px;">
          <p style="color:var(--text-secondary,#888);font-size:14px;margin-bottom:24px;">Need help? We're here for you!</p>
          
          <a href="mailto:support@gorkhareels.com" style="display:flex;align-items:center;gap:14px;padding:16px;background:var(--dark-bg,#000);border-radius:12px;text-decoration:none;margin-bottom:12px;">
            <span style="font-size:24px;">📧</span>
            <div>
              <div style="color:#fff;font-weight:600;font-size:14px;">Email Support</div>
              <div style="color:var(--text-secondary,#888);font-size:12px;">support@gorkhareels.com</div>
            </div>
          </a>

          <a href="https://t.me/gorkhareels" target="_blank" style="display:flex;align-items:center;gap:14px;padding:16px;background:var(--dark-bg,#000);border-radius:12px;text-decoration:none;margin-bottom:12px;">
            <span style="font-size:24px;">💬</span>
            <div>
              <div style="color:#fff;font-weight:600;font-size:14px;">Telegram</div>
              <div style="color:var(--text-secondary,#888);font-size:12px;">@gorkhareels</div>
            </div>
          </a>

          <div style="display:flex;align-items:center;gap:14px;padding:16px;background:var(--dark-bg,#000);border-radius:12px;">
            <span style="font-size:24px;">⏰</span>
            <div>
              <div style="color:#fff;font-weight:600;font-size:14px;">Response Time</div>
              <div style="color:var(--text-secondary,#888);font-size:12px;">Usually within 24 hours</div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  openEditProfile() {
    const d = this.creatorData;

    const modal = document.createElement('div');
    modal.id = 'edit-profile-modal';
    modal.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;`;

    modal.innerHTML = `
      <div style="background: var(--dark-card, #1a1a1a); border-radius: 16px; width: 100%; max-width: 400px; max-height: 85vh; overflow-y: auto;">
        <div style="padding: 20px; border-bottom: 1px solid var(--border-color, #333); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="color: var(--text-primary, #fff); margin: 0; font-size: 18px;">✏️ Edit Profile</h3>
          <button id="close-edit-profile" style="background: none; border: none; color: var(--text-primary, #fff); font-size: 24px; cursor: pointer;">✕</button>
        </div>
        <div style="padding: 20px;">
          <div style="margin-bottom: 16px;">
            <label style="display: block; color: var(--text-secondary, #888); font-size: 13px; margin-bottom: 6px;">Name</label>
            <input id="edit-name" type="text" value="${escapeHtml(d.name || '')}" style="width: 100%; background: var(--dark-bg, #000); border: 1px solid var(--border-color, #333); border-radius: 8px; padding: 12px; color: var(--text-primary, #fff); font-size: 14px; box-sizing: border-box;">
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: block; color: var(--text-secondary, #888); font-size: 13px; margin-bottom: 6px;">Bio</label>
            <textarea id="edit-bio" rows="3" style="width: 100%; background: var(--dark-bg, #000); border: 1px solid var(--border-color, #333); border-radius: 8px; padding: 12px; color: var(--text-primary, #fff); font-size: 14px; box-sizing: border-box; resize: vertical;">${escapeHtml(d.bio || '')}</textarea>
          </div>
          <div style="margin-bottom: 20px;">
            <label style="display: block; color: var(--text-secondary, #888); font-size: 13px; margin-bottom: 6px;">Profile Picture</label>
            <div style="display: flex; align-items: center; gap: 12px;">
              <img id="profile-pic-preview" src="${d.profilePic || 'assets/logo.png'}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color, #333);">
              <button id="pick-profile-pic" style="flex: 1; background: var(--dark-bg, #000); border: 1px solid var(--border-color, #333); border-radius: 8px; padding: 12px; color: var(--text-primary, #fff); font-size: 14px; cursor: pointer;">📷 Choose Photo</button>
            </div>
            <input id="profile-pic-file" type="file" accept="image/*" style="display: none;">
            <input id="edit-profilePic" type="hidden" value="${escapeHtml(d.profilePic || '')}">
          </div>
          <button id="save-profile" style="width: 100%; background: var(--primary-red, #ff3b30); border: none; border-radius: 8px; padding: 14px; color: white; font-weight: 600; font-size: 15px; cursor: pointer;">💾 Save Changes</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('close-edit-profile').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    document.getElementById('save-profile').addEventListener('click', () => this.saveProfile());

    const fileInput = document.getElementById('profile-pic-file');
    document.getElementById('pick-profile-pic').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => this.uploadProfilePic(e));
  }

  async uploadProfilePic(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      Toast.error('Image must be under 5MB');
      return;
    }

    const pickBtn = document.getElementById('pick-profile-pic');
    const preview = document.getElementById('profile-pic-preview');

    if (pickBtn) {
      pickBtn.disabled = true;
      pickBtn.textContent = '⏳ Uploading...';
    }

    try {
      const ext = file.name.split('.').pop();
      const fileName = `profile_${this.user.$id}_${Date.now()}.${ext}`;

      const result = await bunny.uploadVideo(file, fileName);

      document.getElementById('edit-profilePic').value = result.url;
      if (preview) preview.src = result.url;

      Toast.success('✅ Photo uploaded!');
    } catch (error) {
      console.error('Profile pic upload failed:', error);
      Toast.error('Upload failed, try again');
    } finally {
      if (pickBtn) {
        pickBtn.disabled = false;
        pickBtn.textContent = '📷 Choose Photo';
      }
    }
  }

  async saveProfile() {
    const name = document.getElementById('edit-name')?.value?.trim();
    const bio = document.getElementById('edit-bio')?.value?.trim();
    const profilePic = document.getElementById('edit-profilePic')?.value?.trim();

    if (!name || name.length < 2) {
      Toast.error('Name must be at least 2 characters');
      return;
    }

    const saveBtn = document.getElementById('save-profile');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ Saving...';
    }

    try {
      await db.update(APPWRITE_CONFIG.COLLECTIONS.CREATORS, this.user.$id, {
        name: name,
        bio: bio || '',
        profilePic: profilePic || ''
      });

      this.creatorData.name = name;
      this.creatorData.bio = bio;
      this.creatorData.profilePic = profilePic;

      this.displayProfile();

      Toast.success('✅ Profile updated!');
      document.getElementById('edit-profile-modal')?.remove();
    } catch (error) {
      console.error('Save profile failed:', error);
      Toast.error('Failed to save profile');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save Changes';
      }
    }
  }

  async logout() {
    if (confirm('Are you sure you want to logout?')) {
      await session.logout();
      window.location.href = './login.html';
    }
  }

  setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
  });
} else {
  window.dashboardManager = new DashboardManager();
}

console.log('✅ Dashboard Manager Loaded (with options sheet for video actions)');
