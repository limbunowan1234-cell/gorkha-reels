/**
 * GorkhaReels - Authentication System
 * Uses Appwrite Account API (proper session-based auth)
 *
 * Signup:  account.create() -> creates user + auto-hashes password
 * Login:   account.createEmailPasswordSession() -> creates session
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
   * Handle SIGNUP using Appwrite Account API
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
    if (!this.isValidEmail(email)) {
      this.showError(errorEl, 'Please enter a valid email');
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

      // 1. Create the Appwrite account (password auto-hashed with Argon2)
      const user = await account.create(ID.unique(), email, password, name);
      console.log('✅ Account created:', user.$id);

      // 2. Log them in immediately
      await account.createEmailPasswordSession(email, password);
      await session.refresh();

      // 3. Create their creator profile in the database
      try {
        await db.create(
          APPWRITE_CONFIG.COLLECTIONS.CREATORS,
          {
            userId: user.$id,
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
        // Profile creation failed but account exists - not fatal
        console.warn('Profile creation warning:', profileErr.message);
      }

      Toast.success('Account created! Welcome to GorkhaReels! 🎉');
      setTimeout(() => {
        window.location.href = './index.html';
      }, 1000);

    } catch (error) {
      console.error('Signup error:', error);
      let msg = 'Signup failed. Please try again.';
      if (error.message) {
        if (error.message.includes('already exists') ||
            error.message.includes('A user with the same')) {
          msg = 'Email already registered. Please sign in.';
        } else {
          msg = error.message;
        }
      }
      this.showError(errorEl, msg);
    } finally {
      signupBtn.disabled = false;
      signupBtn.classList.remove('loading');
      signupBtn.textContent = '🎬 Create Account';
    }
  }

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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
  });
} else {
  window.authManager = new AuthManager();
}

console.log('✅ Auth Manager Loaded (Account API)');
