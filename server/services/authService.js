// Authentication & Authorization Service
// Säker hantering av användare och behörigheter

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { SECURITY_CONFIG } = require('../config/security');
const ErrorHandler = require('../middleware/errorHandler');

class AuthService {
  constructor() {
    this.sessions = new Map(); // In production, use Redis or database
    this.loginAttempts = new Map(); // Track failed login attempts
    this.passwordResets = new Map(); // Track password reset tokens
  }

  // User registration with strong validation
  async registerUser(userData) {
    const { username, email, password, firstName, lastName, role = 'user' } = userData;

    // Validate required fields
    if (!username || !email || !password || !firstName || !lastName) {
      throw ErrorHandler.ValidationError('Alla obligatoriska fält måste fyllas i', {
        required: ['username', 'email', 'password', 'firstName', 'lastName']
      });
    }

    // Validate password strength
    if (!this.isPasswordStrong(password)) {
      throw ErrorHandler.ValidationError('Lösenordet uppfyller inte säkerhetskraven', {
        requirements: SECURITY_CONFIG.PASSWORD_POLICY
      });
    }

    // Check if user already exists
    if (await this.userExists(username, email)) {
      throw ErrorHandler.ConflictError('Användare med detta användarnamn eller e-post finns redan');
    }

    // Hash password
    const saltRounds = SECURITY_CONFIG.PASSWORD_POLICY.saltRounds;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user object
    const user = {
      id: this.generateUserId(),
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      isActive: true,
      emailVerified: false,
      twoFactorEnabled: false,
      loginAttempts: 0,
      lockoutUntil: null
    };

    // Save user (implement based on your storage system)
    await this.saveUser(user);

    // Return safe user data (without password)
    return this.sanitizeUser(user);
  }

  // User login with comprehensive security
  async loginUser(credentials, req) {
    const { username, password, rememberMe = false } = credentials;
    const clientIp = req.ip;
    const userAgent = req.get('user-agent');

    // Basic validation
    if (!username || !password) {
      throw ErrorHandler.ValidationError('Användarnamn och lösenord krävs');
    }

    // Check rate limiting for this IP/username combination
    const attemptKey = `${clientIp}:${username}`;
    if (this.isRateLimited(attemptKey)) {
      throw ErrorHandler.AuthenticationError('För många inloggningsförsök. Försök igen senare.');
    }

    // Find user
    const user = await this.findUserByUsername(username);
    if (!user) {
      this.recordFailedAttempt(attemptKey);
      throw ErrorHandler.AuthenticationError('Ogiltiga inloggningsuppgifter');
    }

    // Check if account is locked
    if (this.isAccountLocked(user)) {
      throw ErrorHandler.AuthenticationError('Kontot är låst på grund av för många misslyckade inloggningsförsök');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.recordFailedLogin(user.id, clientIp);
      this.recordFailedAttempt(attemptKey);
      throw ErrorHandler.AuthenticationError('Ogiltiga inloggningsuppgifter');
    }

    // Check if account is active
    if (!user.isActive) {
      throw ErrorHandler.AuthenticationError('Kontot är inaktiverat');
    }

    // Successful login
    await this.recordSuccessfulLogin(user.id, clientIp, userAgent);
    this.clearFailedAttempts(attemptKey);

    // Create session
    const session = await this.createSession(user, req, rememberMe);

    return {
      user: this.sanitizeUser(user),
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
        csrfToken: session.csrfToken
      }
    };
  }

  // Logout user and cleanup session
  async logoutUser(sessionId, req) {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Log logout event
      console.log(`User ${session.userId} logged out from ${req.ip}`);
      
      // Remove session
      this.sessions.delete(sessionId);
      
      // Clear session cookie
      if (req.session) {
        req.session.destroy();
      }
    }
  }

  // Create secure session
  async createSession(user, req, rememberMe = false) {
    const sessionId = this.generateSessionId();
    const expiresAt = new Date();
    
    if (rememberMe) {
      expiresAt.setTime(expiresAt.getTime() + SECURITY_CONFIG.SESSION.REMEMBER_ME_DURATION);
    } else {
      expiresAt.setTime(expiresAt.getTime() + SECURITY_CONFIG.SESSION.DURATION);
    }

    const session = {
      id: sessionId,
      userId: user.id,
      username: user.username,
      role: user.role,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      csrfToken: this.generateCsrfToken(),
      isRemembered: rememberMe
    };

    // Store session
    this.sessions.set(sessionId, session);

    // Set session in request
    if (req.session) {
      req.session.sessionId = sessionId;
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.csrfToken = session.csrfToken;
    }

    return session;
  }

  // Validate session and return user
  async validateSession(sessionId, req) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw ErrorHandler.AuthenticationError('Session hittades inte');
    }

    // Check if session has expired
    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(sessionId);
      throw ErrorHandler.AuthenticationError('Session har gått ut');
    }

    // Validate IP address (optional security check)
    if (SECURITY_CONFIG.SESSION.BIND_TO_IP && session.ipAddress !== req.ip) {
      this.sessions.delete(sessionId);
      throw ErrorHandler.AuthenticationError('Session ogiltig');
    }

    // Validate user agent (basic session hijacking protection)
    if (session.userAgent !== req.get('user-agent')) {
      this.sessions.delete(sessionId);
      throw ErrorHandler.AuthenticationError('Session ogiltig');
    }

    // Update session activity
    this.updateSessionActivity(session);

    return session;
  }

  // Check if user has required role/permission
  hasPermission(userRole, requiredRole) {
    const roleHierarchy = {
      'user': 1,
      'moderator': 2,
      'admin': 3,
      'superadmin': 4
    };

    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    return userLevel >= requiredLevel;
  }

  // Middleware to require authentication
  requireAuth(requiredRole = 'user') {
    return async (req, res, next) => {
      try {
        const sessionId = req.session?.sessionId || req.headers['x-session-id'];
        
        if (!sessionId) {
          throw ErrorHandler.AuthenticationError('Ingen session hittades');
        }

        const session = await this.validateSession(sessionId, req);
        
        // Check role if specified
        if (requiredRole && !this.hasPermission(session.role, requiredRole)) {
          throw ErrorHandler.AuthorizationError(`Kräver behörighet: ${requiredRole}`);
        }

        // Add user info to request
        req.user = {
          id: session.userId,
          username: session.username,
          role: session.role
        };

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  // Change user password
  async changePassword(userId, oldPassword, newPassword) {
    const user = await this.findUserById(userId);
    if (!user) {
      throw ErrorHandler.AuthenticationError('Användare hittades inte');
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw ErrorHandler.AuthenticationError('Nuvarande lösenord är felaktigt');
    }

    // Validate new password
    if (!this.isPasswordStrong(newPassword)) {
      throw ErrorHandler.ValidationError('Nytt lösenord uppfyller inte säkerhetskraven');
    }

    // Check if new password is different from old
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw ErrorHandler.ValidationError('Nytt lösenord måste skilja sig från det nuvarande');
    }

    // Hash new password
    const saltRounds = SECURITY_CONFIG.PASSWORD_POLICY.saltRounds;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user
    user.password = hashedPassword;
    user.updatedAt = new Date().toISOString();
    await this.saveUser(user);

    // Invalidate all sessions for this user (force re-login)
    this.invalidateUserSessions(userId);

    return { success: true, message: 'Lösenord uppdaterat' };
  }

  // Generate password reset token
  async generatePasswordResetToken(email) {
    const user = await this.findUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return { success: true, message: 'Om e-postadressen finns kommer du att få instruktioner' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    this.passwordResets.set(token, {
      userId: user.id,
      email: user.email,
      expiresAt: expiresAt.toISOString(),
      used: false
    });

    // In production, send email with reset link
    console.log(`Password reset token for ${email}: ${token}`);

    return { success: true, message: 'Om e-postadressen finns kommer du att få instruktioner' };
  }

  // Reset password with token
  async resetPassword(token, newPassword) {
    const resetData = this.passwordResets.get(token);
    if (!resetData || resetData.used || new Date(resetData.expiresAt) < new Date()) {
      throw ErrorHandler.ValidationError('Ogiltig eller utgången återställningstoken');
    }

    // Validate new password
    if (!this.isPasswordStrong(newPassword)) {
      throw ErrorHandler.ValidationError('Lösenord uppfyller inte säkerhetskraven');
    }

    const user = await this.findUserById(resetData.userId);
    if (!user) {
      throw ErrorHandler.ValidationError('Användare hittades inte');
    }

    // Hash new password
    const saltRounds = SECURITY_CONFIG.PASSWORD_POLICY.saltRounds;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user
    user.password = hashedPassword;
    user.updatedAt = new Date().toISOString();
    await this.saveUser(user);

    // Mark token as used
    resetData.used = true;

    // Invalidate all sessions
    this.invalidateUserSessions(user.id);

    return { success: true, message: 'Lösenord återställt' };
  }

  // Helper methods

  isPasswordStrong(password) {
    const policy = SECURITY_CONFIG.PASSWORD_POLICY;
    
    if (password.length < policy.minLength) return false;
    if (policy.requireUppercase && !/[A-Z]/.test(password)) return false;
    if (policy.requireLowercase && !/[a-z]/.test(password)) return false;
    if (policy.requireNumbers && !/\d/.test(password)) return false;
    if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false;

    // Check against common passwords (basic check)
    const commonPasswords = ['password', '123456', 'admin', 'qwerty', 'password123'];
    if (commonPasswords.includes(password.toLowerCase())) return false;

    return true;
  }

  isRateLimited(key) {
    const attempts = this.loginAttempts.get(key);
    if (!attempts) return false;
    
    const rateLimitConfig = SECURITY_CONFIG.RATE_LIMIT.LOGIN;
    return attempts.count >= rateLimitConfig.max;
  }

  recordFailedAttempt(key) {
    const now = Date.now();
    const attempts = this.loginAttempts.get(key) || { count: 0, firstAttempt: now };
    
    // Reset counter if window has passed
    if (now - attempts.firstAttempt > SECURITY_CONFIG.RATE_LIMIT.LOGIN.window) {
      attempts.count = 1;
      attempts.firstAttempt = now;
    } else {
      attempts.count++;
    }
    
    this.loginAttempts.set(key, attempts);
  }

  clearFailedAttempts(key) {
    this.loginAttempts.delete(key);
  }

  isAccountLocked(user) {
    return user.lockoutUntil && new Date(user.lockoutUntil) > new Date();
  }

  generateUserId() {
    return `user_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  sanitizeUser(user) {
    const { password, ...safeUser } = user;
    return safeUser;
  }

  updateSessionActivity(session) {
    session.lastActivity = new Date().toISOString();
  }

  invalidateUserSessions(userId) {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sessionId);
      }
    }
  }

  // Mock storage methods (implement with your actual storage)
  async userExists(username, email) {
    // Implement actual user lookup
    return false;
  }

  async findUserByUsername(username) {
    // Implement actual user lookup
    return null;
  }

  async findUserByEmail(email) {
    // Implement actual user lookup
    return null;
  }

  async findUserById(id) {
    // Implement actual user lookup
    return null;
  }

  async saveUser(user) {
    // Implement actual user saving
    console.log('Saving user:', user.username);
  }

  async recordFailedLogin(userId, ip) {
    // Implement actual logging
    console.log(`Failed login for user ${userId} from ${ip}`);
  }

  async recordSuccessfulLogin(userId, ip, userAgent) {
    // Implement actual logging
    console.log(`Successful login for user ${userId} from ${ip}`);
  }
}

module.exports = new AuthService();