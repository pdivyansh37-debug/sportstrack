/**
 * ACL-Shield & AdaptiFit Authentication Manager
 * Handles Google OAuth 2.0 (Google Identity Services), Email/Password Authentication,
 * Session Persistence, and Google Cloud Client ID Configuration.
 */

export class AuthManager {
  constructor() {
    this.sessionKey = 'acl_shield_auth_user';
    this.usersKey = 'acl_shield_registered_users';
    this.googleClientIdKey = 'acl_shield_google_client_id';
    
    // Default placeholder Google Client ID (User can replace via Google Cloud Config modal or set here)
    this.defaultGoogleClientId = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
    
    this.currentUser = this.loadSession();
    this.registeredUsers = this.loadRegisteredUsers();
    this.googleClientId = this.loadGoogleClientId();
    
    this.listeners = [];
  }

  /**
   * Subscribe to auth changes (login, logout, user updates)
   */
  onAuthChange(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  notifyListeners(eventType, user) {
    this.listeners.forEach(cb => {
      try {
        cb(eventType, user);
      } catch (err) {
        console.error('Error in auth listener:', err);
      }
    });
  }

  /**
   * Load active user session from localStorage
   */
  loadSession() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = window.localStorage.getItem(this.sessionKey);
        return data ? JSON.parse(data) : null;
      }
    } catch (e) {
      console.warn('Failed to load session:', e);
    }
    return null;
  }

  /**
   * Load registered accounts database from localStorage
   */
  loadRegisteredUsers() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = window.localStorage.getItem(this.usersKey);
        if (data) return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load users:', e);
    }
    
    // Seed with a default demonstration user
    const defaultUsers = [
      {
        id: 'usr_demo_1',
        name: 'Dr. Marcus Vance',
        email: 'marcus.vance@sportsbiomechanics.io',
        password: 'password123',
        role: 'Biomechanist / Head Coach',
        sport: 'basketball',
        provider: 'local',
        avatarUrl: '',
        createdAt: new Date().toLocaleDateString()
      }
    ];
    this.saveRegisteredUsers(defaultUsers);
    return defaultUsers;
  }

  saveRegisteredUsers(users) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.usersKey, JSON.stringify(users));
      }
    } catch (e) {
      console.warn('Failed to save registered users:', e);
    }
  }

  /**
   * Load or retrieve Google Client ID
   */
  loadGoogleClientId() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const id = window.localStorage.getItem(this.googleClientIdKey);
        if (id && id.trim()) return id.trim();
      }
    } catch (e) {}
    return this.defaultGoogleClientId;
  }

  /**
   * Update and persist Google Cloud Client ID
   */
  setGoogleClientId(clientId) {
    const cleanId = (clientId || '').trim();
    this.googleClientId = cleanId || this.defaultGoogleClientId;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (cleanId) {
          window.localStorage.setItem(this.googleClientIdKey, cleanId);
        } else {
          window.localStorage.removeItem(this.googleClientIdKey);
        }
      }
    } catch (e) {
      console.warn('Failed to save Google Client ID:', e);
    }
    
    // Re-initialize Google Sign-in with new Client ID if Google SDK is loaded
    this.initGoogleIdentity();
    return this.googleClientId;
  }

  getGoogleClientId() {
    return this.googleClientId;
  }

  isGoogleConfigured() {
    return this.googleClientId && 
           this.googleClientId !== this.defaultGoogleClientId && 
           this.googleClientId.includes('.apps.googleusercontent.com');
  }

  /**
   * Initialize Google Identity Services (GIS)
   */
  initGoogleIdentity(buttonContainerId = 'googleSignInBtnMount') {
    if (typeof window === 'undefined' || !window.google || !window.google.accounts || !window.google.accounts.id) {
      return false;
    }

    try {
      const clientId = this.isGoogleConfigured() ? this.googleClientId : this.defaultGoogleClientId;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => this.handleGoogleCredentialResponse(response),
        auto_select: false,
        cancel_on_tap_outside: true
      });

      const buttonMount = document.getElementById(buttonContainerId);
      if (buttonMount) {
        buttonMount.innerHTML = '';
        window.google.accounts.id.renderButton(
          buttonMount,
          {
            theme: 'filled_black',
            size: 'large',
            type: 'standard',
            shape: 'pill',
            text: 'signin_with',
            logo_alignment: 'left',
            width: buttonMount.offsetWidth || 280
          }
        );
      }
      return true;
    } catch (err) {
      console.warn('Google Identity initialization notice:', err);
      return false;
    }
  }

  /**
   * Parse Google JWT token payload
   */
  parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Failed to parse JWT token', e);
      return null;
    }
  }

  /**
   * Handle Google Credential Response
   */
  handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) {
      throw new Error('No credential received from Google Identity Services.');
    }

    const payload = this.parseJwt(response.credential);
    if (!payload) {
      throw new Error('Unable to decode Google credential token.');
    }

    const user = {
      id: 'g_' + (payload.sub || Date.now()),
      name: payload.name || payload.email.split('@')[0],
      email: payload.email,
      avatarUrl: payload.picture || '',
      role: 'Athlete / Sports Practitioner',
      sport: 'basketball',
      provider: 'google',
      googleSub: payload.sub,
      emailVerified: payload.email_verified || true,
      lastLogin: new Date().toISOString()
    };

    return this.saveSession(user);
  }

  /**
   * Simulate or execute Google sign-in (handles both live Client ID & instant demo fallback)
   */
  async signInWithGooglePrompt() {
    // If GIS is loaded and configured with valid client ID
    if (this.isGoogleConfigured() && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.log('Google One-Tap not displayed or skipped. Use the direct button.');
          }
        });
        return { status: 'prompted' };
      } catch (e) {
        console.warn('Google prompt fallback:', e);
      }
    }

    // Interactive Demo Google Auth simulation when Client ID is pending
    const demoGoogleUser = {
      id: 'g_demo_' + Date.now(),
      name: 'Elena Rostova (Google)',
      email: 'elena.rostova@athletics.org',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role: 'Elite Athlete & Track Coach',
      sport: 'running',
      provider: 'google',
      emailVerified: true,
      lastLogin: new Date().toISOString()
    };

    const user = this.saveSession(demoGoogleUser);
    return { status: 'success', user, isSimulated: !this.isGoogleConfigured() };
  }

  /**
   * Sign In with Email and Password
   */
  signInWithCredentials(email, password, rememberMe = true) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanEmail) {
      throw new Error('Please enter your email address.');
    }
    if (!cleanPass) {
      throw new Error('Please enter your password.');
    }

    const existingUser = this.registeredUsers.find(
      u => u.email.toLowerCase() === cleanEmail && u.password === cleanPass
    );

    if (!existingUser) {
      throw new Error('Invalid email or password. Please verify credentials or create an account.');
    }

    const user = {
      id: existingUser.id,
      name: existingUser.name,
      email: existingUser.email,
      role: existingUser.role || 'Athlete / Physical Therapist',
      sport: existingUser.sport || 'basketball',
      avatarUrl: existingUser.avatarUrl || '',
      provider: 'local',
      lastLogin: new Date().toISOString()
    };

    return this.saveSession(user, rememberMe);
  }

  /**
   * Register a new user
   */
  signUp(name, email, password, role = 'Athlete', sport = 'basketball') {
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanName) {
      throw new Error('Please enter your full name.');
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please provide a valid email address.');
    }
    if (!cleanPass || cleanPass.length < 6) {
      throw new Error('Password must contain at least 6 characters.');
    }

    const existing = this.registeredUsers.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error('An account with this email address already exists. Please sign in.');
    }

    const newUser = {
      id: 'usr_' + Date.now(),
      name: cleanName,
      email: cleanEmail,
      password: cleanPass,
      role: role || 'Athlete / Coach',
      sport: sport || 'basketball',
      avatarUrl: '',
      provider: 'local',
      createdAt: new Date().toLocaleDateString()
    };

    this.registeredUsers.push(newUser);
    this.saveRegisteredUsers(this.registeredUsers);

    const userSession = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      sport: newUser.sport,
      avatarUrl: '',
      provider: 'local',
      lastLogin: new Date().toISOString()
    };

    return this.saveSession(userSession, true);
  }

  /**
   * Fast 1-Click Guest / Demo Mode
   */
  loginAsGuest() {
    const guestUser = {
      id: 'usr_guest_' + Date.now(),
      name: 'Coach Alex Morgan (Guest)',
      email: 'alex.morgan.guest@adaptifit.ai',
      role: 'Sports Physical Therapist & Coach',
      sport: 'basketball',
      avatarUrl: '',
      provider: 'guest',
      lastLogin: new Date().toISOString()
    };

    return this.saveSession(guestUser, false);
  }

  /**
   * Save session to storage and notify UI
   */
  saveSession(user, remember = true) {
    this.currentUser = user;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.sessionKey, JSON.stringify(user));
      }
    } catch (e) {
      console.warn('Failed to save session:', e);
    }

    this.notifyListeners('login', user);
    return user;
  }

  /**
   * Sign Out
   */
  signOut() {
    const prevUser = this.currentUser;
    this.currentUser = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(this.sessionKey);
      }
      if (window.google?.accounts?.id) {
        window.google.accounts.id.disableAutoSelect();
      }
    } catch (e) {
      console.warn('Failed to clear session:', e);
    }

    this.notifyListeners('logout', prevUser);
  }

  /**
   * Check if user is currently logged in
   */
  isLoggedIn() {
    return !!this.currentUser;
  }

  /**
   * Get current active user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Update active user profile
   */
  updateCurrentUser(updates) {
    if (!this.currentUser) return null;
    this.currentUser = { ...this.currentUser, ...updates };
    this.saveSession(this.currentUser, true);
    
    // Also update in registered list if local user
    if (this.currentUser.provider === 'local') {
      const idx = this.registeredUsers.findIndex(u => u.id === this.currentUser.id);
      if (idx !== -1) {
        this.registeredUsers[idx] = { ...this.registeredUsers[idx], ...updates };
        this.saveRegisteredUsers(this.registeredUsers);
      }
    }

    this.notifyListeners('update', this.currentUser);
    return this.currentUser;
  }
}
