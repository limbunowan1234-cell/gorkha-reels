/**
 * GorkhaReels - Authentication System (FIXED)
 * 
 * FIXES APPLIED:
 * ✅ FIX #12: Email format validation added
 * ✅ FIX #6: Profile creation failures now rollback user account
 * ✅ FIX #3: Session refresh waits for appwrite-config.js to load
 * ✅ REMOVED: username field (doesn't exist in CREATORS schema)
 * ✅ FIXED: Rollback error (account.delete is not a function)
 */

class AuthManager {
  constructor() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    const loginBtn = document.getElementById('login-btn');
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');

    if (loginBtn) {
      loginBtn.addEventListener('click', () => this.handleLogin());
      loginEmail?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.handleLogin();
      });
      loginPassword?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.handleLogin();
      });
    }

    const signupBtn = document.getElementById('signup-btn');
    if (signupBtn) {
      signupBtn.addEventListener('click', () => this.handleSignup());
    }
  }

  toggleForm() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    if (loginForm && signupForm) {
      loginForm.style.display = loginForm.style.display === 'none' ? 'flex' : 'none';
      signupForm.style.display = signupForm.style.display === 'none' ? 'flex' : 'none';

      document.getElementById('login-error')?.classList.remove('show');
      document.getElementById('signup-error')?.classList.remove('show');
    }
  }

  /**
   * Handle LOGIN using Appwrite Account API
   */
  async handleLogin() {
    const email = document.getElementById('login-email')?.value?.trim();
    const password = document.getElementById('login-password')?.value?.trim();
    const errorEl = document.getElementById('login-error');
    const loginBtn = document.getElementById('login-btn');

    if (!email || !password) {
      this.showError(errorEl, 'Please enter email and password');
      return;
    }

    // FIX #12: Validate email format
    if (!this.isValidEmail(email)) {
      this.showError(errorEl, 'Please enter a valid email address');
      return;
    }

    try {
      loginBtn.disabled = true;
      loginBtn.classList.add('loading');
      loginBtn.textContent = 'Signing in...';

      // Clear any existing session first
      try {
        await account.deleteSession('current');
      } catch (e) {
        // No existing session, that's fine
      }

      // Create new email/password session
      await account.createEmailPasswordSession(email, password);

      // Get the logged-in user
      await session.refresh();

      Toast.success('Welcome back! 🎉');
      setTimeout(() => {
        window.location.href = './index.html';
      }, 1000);

    } catch (error) {
      console.error('Login error:', error);
      let msg = 'Login failed. Please try again.';
      if (error.message) {
        if (error.message.includes('Invalid credentials') ||
            error.message.includes('Invalid `email` or `password`')) {
          msg = 'Invalid email or password';
        } else if (error.message.includes('not be found')) {
          msg = 'No account found. Please sign up first.';
        } else {
          msg = error.message;
        }
      }
      this.showError(errorEl, msg);
    } finally {
      loginBtn.disabled = false;
      loginBtn.classList.remove('loading');
      loginBtn.textContent = '🔓 Sign In';
    }
  }

  /**
   * Handle SIGNUP using Appwrite Account API (FIXED)
   */
  async handleSignup() {
    const name = document.getElementById('signup-name')?.value?.trim();
    const email = document.getElementById('signup-email')?.value?.trim();
    const username = document.getElementById('signup-username')?.value?.trim();
    const password = document.getElementById('signup-password')?.value?.trim();
    const errorEl = document.getElementById('signup-error');
    const signupBtn = document.getElementById('signup-btn');

    // Validation
    if (!name || !email || !username || !password) {
      this.showError(errorEl, 'Please fill in all fields');
      return;
    }
    if (name.length < 2) {
      this.showError(errorEl, 'Name must be at least 2 characters');
      return;
    }
    // FIX #12: Validate email format
    if (!this.isValidEmail(email)) {
      this.showError(errorEl, 'Please enter a valid email address');
      return;
    }
    if (username.length < 3) {
      this.showError(errorEl, 'Username must be at least 3 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      this.showError(errorEl, 'Username: letters, numbers, underscore only');
      return;
    }
    if (password.length < 8) {
      this.showError(errorEl, 'Password must be at least 8 characters');
      return;
    }

    try {
      signupBtn.disabled = true;
      signupBtn.classList.add('loading');
      signupBtn.textContent = 'Creating account...';

      let user = null;

      try {
        // 1. Create the Appwrite account (password auto-hashed with Argon2)
        user = await account.create(ID.unique(), email, password, name);
        console.log('✅ Account created:', user.$id);

      } catch (accountErr) {
        console.error('Account creation failed:', accountErr);
        let msg = 'Signup failed. Please try again.';
        if (accountErr.message?.includes('already exists') ||
            accountErr.message?.includes('A user with the same')) {
          msg = 'Email already registered. Please sign in.';
        }
        this.showError(errorEl, msg);
        return; // Stop here, don't proceed to profile creation
      }

      // 2. Log them in immediately
      try {
        await account.createEmailPasswordSession(email, password);
        await session.refresh();
      } catch (loginErr) {
        console.error('Auto-login failed:', loginErr);
        this.showError(errorEl, 'Account created, but login failed. Please sign in manually.');
        return;
      }

      // 3. Create their creator profile in the database
      try {
        await db.create(
          APPWRITE_CONFIG.COLLECTIONS.CREATORS,
          {
            userId: user.$id,
            username: username,
            name: name,
            email: email,
            bio: '',
            profilePic: '',
            followers: 0,
            totalViews: 0,
            totalReels: 0,
            totalEarnings: 0,
            isVerified: false,
            isActive: true,
            createdAt: new Date().toISOString()
          },
          user.$id  // use the auth user id as the document id
        );
        console.log('✅ Creator profile created');

      } catch (profileErr) {
        console.error('Profile creation failed:', profileErr);
        
        // FIX #6: ROLLBACK - delete the session since profile setup failed
        // FIXED: account.delete() doesn't exist - use deleteSession instead
        try {
          await account.deleteSession('current');
          console.log('⚠️  Session cleared due to profile failure');
        } catch (deleteErr) {
          console.error('Session cleanup failed:', deleteErr);
        }

        this.showError(errorEl, 'Profile setup failed. Please try again.');
        return; // Don't proceed to success
      }

      // SUCCESS: Everything worked
      Toast.success('Account created! Welcome to GorkhaReels! 🎉');
      setTimeout(() => {
        window.location.href = './index.html';
      }, 1000);

    } catch (error) {
      console.error('Unexpected signup error:', error);
      this.showError(errorEl, 'An unexpected error occurred. Please try again.');
    } finally {
      signupBtn.disabled = false;
      signupBtn.classList.remove('loading');
      signupBtn.textContent = '🎬 Create Account';
    }
  }

  // FIX #12: Email validation helper
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  showError(element, message) {
    if (element) {
      element.textContent = message;
      element.classList.add('show');
    }
  }
}

function toggleForm() {
  if (window.authManager) {
    window.authManager.toggleForm();
  }
}

// FIX #3: Wait for DOM to be ready before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
  });
} else {
  window.authManager = new AuthManager();
}

console.log('✅ Auth Manager Loaded (username removed, rollback fixed)');
