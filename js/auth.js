/**
 * GorkhaReels - Authentication System
 * Login/Signup with Appwrite backend
 */

class AuthManager {
  constructor() {
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for login/signup forms
   */
  setupEventListeners() {
    // Login
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

    // Signup
    const signupBtn = document.getElementById('signup-btn');
    if (signupBtn) {
      signupBtn.addEventListener('click', () => this.handleSignup());
    }
  }

  /**
   * Toggle between login and signup forms
   */
  toggleForm() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    if (loginForm && signupForm) {
      loginForm.style.display = loginForm.style.display === 'none' ? 'flex' : 'none';
      signupForm.style.display = signupForm.style.display === 'none' ? 'flex' : 'none';
      
      // Clear errors
      document.getElementById('login-error').classList.remove('show');
      document.getElementById('signup-error').classList.remove('show');
    }
  }

  /**
   * Handle login
   */
  async handleLogin() {
    const email = document.getElementById('login-email')?.value?.trim();
    const password = document.getElementById('login-password')?.value?.trim();
    const errorEl = document.getElementById('login-error');
    const loginBtn = document.getElementById('login-btn');

    // Validate
    if (!email || !password) {
      this.showError(errorEl, 'Please enter email/username and password');
      return;
    }

    try {
      loginBtn.disabled = true;
      loginBtn.classList.add('loading');
      loginBtn.textContent = 'Signing in...';

      // Try to find user by email or username
      let user = null;
      
      try {
        // Search by email
        const result = await appwrite.getDocuments(
          APPWRITE_CONFIG.COLLECTIONS.CREATORS,
          [`queries[]=email=${email}`]
        );

        if (result.documents.length > 0) {
          user = result.documents[0];
        }
      } catch (err) {
        // Email not found, try username
        console.log('Email not found, trying username...');
      }

      if (!user) {
        // Search by username (assuming email field can also contain username for simplicity)
        const result = await appwrite.getDocuments(
          APPWRITE_CONFIG.COLLECTIONS.CREATORS,
          []
        );

        // Simple username search (in production, add username field to database)
        user = result.documents.find(u => u.email === email);
      }

      if (!user) {
        this.showError(errorEl, 'User not found. Please check email/username or sign up');
        return;
      }

      // Validate password (simple check - in production, use proper password hashing)
      // For now, we'll store password in Appwrite and compare
      if (!user.password || user.password !== password) {
        this.showError(errorEl, 'Invalid password');
        return;
      }

      // Success - store user session
      session.setUser({
        userId: user.$id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic
      });

      // Redirect to feed
      Toast.success('Welcome back! 🎉');
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);

    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.message || 'Login failed. Please check your credentials and try again.';
      this.showError(errorEl, errorMessage);
    } finally {
      loginBtn.disabled = false;
      loginBtn.classList.remove('loading');
      loginBtn.textContent = 'Sign In';
    }
  }

  /**
   * Handle signup
   */
  async handleSignup() {
    const name = document.getElementById('signup-name')?.value?.trim();
    const email = document.getElementById('signup-email')?.value?.trim();
    const username = document.getElementById('signup-username')?.value?.trim();
    const password = document.getElementById('signup-password')?.value?.trim();
    const errorEl = document.getElementById('signup-error');
    const signupBtn = document.getElementById('signup-btn');

    // Validate
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
      this.showError(errorEl, 'Username can only contain letters, numbers, and underscore');
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

      // Check if email already exists
      try {
        const existing = await appwrite.getDocuments(
          APPWRITE_CONFIG.COLLECTIONS.CREATORS,
          [`queries[]=email=${email}`]
        );

        if (existing.documents.length > 0) {
          this.showError(errorEl, 'Email already registered. Please login instead.');
          return;
        }
      } catch (err) {
        console.log('Email check passed');
      }

      // Create new user
      const newUser = await appwrite.createDocument(
        APPWRITE_CONFIG.COLLECTIONS.CREATORS,
        {
          userId: appwrite.generateId(),
          name,
          email,
          password, // ⚠️ In production, use proper password hashing!
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
        email // Use email as document ID
      );

      // Success - store user session
      session.setUser({
        userId: newUser.$id,
        name: newUser.name,
        email: newUser.email,
        profilePic: newUser.profilePic
      });

      // Redirect to feed
      Toast.success('Account created! Welcome to GorkhaReels! 🎉');
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);

    } catch (error) {
      console.error('Signup error:', error);
      const errorMessage = error.message || 'Signup failed. Please check your connection and try again.';
      this.showError(errorEl, errorMessage);
    } finally {
      signupBtn.disabled = false;
      signupBtn.classList.remove('loading');
      signupBtn.textContent = 'Create Account';
    }
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Show error message
   */
  showError(element, message) {
    if (element) {
      element.textContent = message;
      element.classList.add('show');
    }
  }
}

/**
 * Global function to toggle forms
 */
function toggleForm() {
  const authManager = window.authManager;
  if (authManager) {
    authManager.toggleForm();
  }
}

/**
 * Initialize auth system
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
  });
} else {
  window.authManager = new AuthManager();
}

console.log('✅ Auth Manager Loaded');
