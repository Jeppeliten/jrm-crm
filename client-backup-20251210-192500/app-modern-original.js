// Modern CRM Application - Main Entry Point
// Refactored for production-grade code quality and maintainability

import { AppConfig } from './js/config/AppConfig.js';
import { AppState } from './js/state/AppState.js';
import { SecurityManager } from './js/security/SecurityManager.js';
import { ViewManager } from './js/views/ViewManager.js';
import { ModalManager } from './js/ui/ModalManager.js';
import { EventBus } from './js/utils/EventBus.js';
import { NotificationService } from './js/ui/NotificationService.js';
import { ErrorHandler } from './js/utils/ErrorHandler.js';
import { PerformanceMonitor } from './js/utils/PerformanceMonitor.js';

/**
 * Main Application Class - Professional CRM System
 * Orchestrates all application components with proper separation of concerns
 */
class CRMApplication {
  constructor() {
    this.isInitialized = false;
    this.components = new Map();
    this.eventBus = new EventBus();
    this.performanceMonitor = new PerformanceMonitor();
    
    // Bind methods to maintain context
    this.handleError = this.handleError.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  /**
   * Initialize the complete application
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      console.log('­ƒÜÇ Initializing CRM Application...');
      
      // Performance monitoring
      this.performanceMonitor.mark('app-init-start');
      
      // Set up global error handling
      this.setupGlobalErrorHandling();
      
      // Initialize core components in dependency order
      await this.initializeCoreComponents();
      
      // Initialize UI components
      await this.initializeUIComponents();
      
      // Set up application lifecycle handlers
      this.setupLifecycleHandlers();
      
      // Load and validate initial data
      await this.loadInitialData();
      
      // Start the application
      this.startApplication();
      
      this.performanceMonitor.mark('app-init-end');
      this.performanceMonitor.measure('app-initialization', 'app-init-start', 'app-init-end');
      
      this.isInitialized = true;
      
      // Emit initialization complete event
      this.eventBus.emit('app:initialized', {
        timestamp: new Date().toISOString(),
        performance: this.performanceMonitor.getMetrics()
      });
      
      console.log('Ô£à CRM Application initialized successfully');
      
    } catch (error) {
      console.error('ÔØî Failed to initialize CRM Application:', error);
      this.handleError(error, 'INITIALIZATION_ERROR');
      throw error;
    }
  }

  /**
   * Initialize core application components
   * @private
   */
  async initializeCoreComponents() {
    // Security Manager - First for protection
    const securityManager = new SecurityManager({
      csrfProtection: true,
      sessionTimeout: AppConfig.SESSION_TIMEOUT,
      encryptLocalStorage: true
    });
    await securityManager.initialize();
    this.components.set('security', securityManager);
    
    // Application State - Central data management
    const appState = new AppState({
      storageKey: AppConfig.STORAGE_KEY,
      encryption: securityManager.getStorageEncryption(),
      validation: true,
      migrations: true
    });
    await appState.initialize();
    this.components.set('state', appState);
    
    // Error Handler - Centralized error management
    const errorHandler = new ErrorHandler({
      reportingEnabled: AppConfig.ERROR_REPORTING,
      logLevel: AppConfig.LOG_LEVEL,
      eventBus: this.eventBus
    });
    this.components.set('errorHandler', errorHandler);
    
    console.log('Ô£à Core components initialized');
  }

  /**
   * Initialize UI components
   * @private
   */
  async initializeUIComponents() {
    // Modal Manager - Centralized modal handling
    const modalManager = new ModalManager({
      eventBus: this.eventBus,
      animationDuration: 300,
      stackNavigation: true
    });
    await modalManager.initialize();
    this.components.set('modal', modalManager);
    
    // View Manager - Page/view navigation
    const viewManager = new ViewManager({
      eventBus: this.eventBus,
      state: this.components.get('state'),
      security: this.components.get('security')
    });
    await viewManager.initialize();
    this.components.set('views', viewManager);
    
    // Notification Service - User feedback
    const notificationService = new NotificationService({
      eventBus: this.eventBus,
      position: 'top-right',
      autoHide: true,
      duration: 5000
    });
    await notificationService.initialize();
    this.components.set('notifications', notificationService);
    
    console.log('Ô£à UI components initialized');
  }

  /**
   * Set up global error handling
   * @private
   */
  setupGlobalErrorHandling() {
    // Unhandled errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error || new Error(event.message), 'GLOBAL_ERROR', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        event.reason instanceof Error ? event.reason : new Error(event.reason),
        'UNHANDLED_PROMISE_REJECTION'
      );
      event.preventDefault(); // Prevent console logging
    });

    // Security errors
    window.addEventListener('securitypolicyviolation', (event) => {
      this.handleError(new Error(`CSP Violation: ${event.violatedDirective}`), 'SECURITY_VIOLATION', {
        directive: event.violatedDirective,
        blockedURI: event.blockedURI,
        sourceFile: event.sourceFile
      });
    });
  }

  /**
   * Set up application lifecycle handlers
   * @private
   */
  setupLifecycleHandlers() {
    // Before page unload - save data
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    
    // Page visibility change - handle focus/blur
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Page focus/blur - security and performance
    window.addEventListener('focus', () => {
      this.eventBus.emit('app:focus');
      this.components.get('security')?.onApplicationFocus();
    });
    
    window.addEventListener('blur', () => {
      this.eventBus.emit('app:blur');
      this.components.get('security')?.onApplicationBlur();
    });

    // Network status changes
    window.addEventListener('online', () => {
      this.eventBus.emit('app:online');
      this.components.get('notifications')?.show('Anslutning ├Ñterst├ñlld', 'success');
    });
    
    window.addEventListener('offline', () => {
      this.eventBus.emit('app:offline');
      this.components.get('notifications')?.show('Ingen internetanslutning', 'warning');
    });
  }

  /**
   * Load and validate initial application data
   * @private
   */
  async loadInitialData() {
    const state = this.components.get('state');
    
    try {
      // Load existing data from storage
      await state.load();
      
      // Run data migrations if needed
      await state.runMigrations();
      
      // Validate data integrity
      const validationResult = await state.validateIntegrity();
      if (!validationResult.isValid) {
        console.warn('Data integrity issues found:', validationResult.errors);
        this.components.get('notifications')?.show(
          'Dataintegritetsvarningar uppt├ñckta. Se konsolen f├Âr detaljer.',
          'warning'
        );
      }
      
      // Seed example data if empty
      if (state.isEmpty()) {
        await this.seedInitialData();
      }
      
    } catch (error) {
      console.error('Failed to load initial data:', error);
      
      // Try to recover from backup
      try {
        await state.restoreFromBackup();
        this.components.get('notifications')?.show('Data ├Ñterst├ñlld fr├Ñn backup', 'info');
      } catch (backupError) {
        console.error('Backup restoration failed:', backupError);
        
        // Last resort: seed with fresh data
        await this.seedInitialData();
        this.components.get('notifications')?.show('Ny dataupps├ñttning skapad', 'info');
      }
    }
  }

  /**
   * Seed initial data for new installations
   * @private
   */
  async seedInitialData() {
    const state = this.components.get('state');
    
    console.log('­ƒôè Seeding initial data...');
    
    // Create default data structure
    await state.seed({
      users: AppConfig.DEFAULT_USERS,
      brands: [],
      companies: [],
      agents: [],
      contacts: [],
      activities: []
    });
    
    // Generate example data if in development
    if (AppConfig.ENVIRONMENT === 'development') {
      await state.generateExampleData();
    }
    
    console.log('Ô£à Initial data seeded');
  }

  /**
   * Start the application after initialization
   * @private
   */
  startApplication() {
    const viewManager = this.components.get('views');
    const security = this.components.get('security');
    
    // Check authentication status
    if (security.isAuthenticated()) {
      // User is logged in, show dashboard
      viewManager.navigateTo('dashboard');
    } else {
      // Show login screen
      viewManager.navigateTo('login');
    }
    
    // Start periodic tasks
    this.startPeriodicTasks();
    
    // Mark app as ready
    document.body.classList.add('app-ready');
    this.eventBus.emit('app:ready');
  }

  /**
   * Start periodic background tasks
   * @private
   */
  startPeriodicTasks() {
    // Auto-save every 30 seconds
    setInterval(() => {
      this.autoSave();
    }, 30000);
    
    // Session check every 5 minutes
    setInterval(() => {
      this.components.get('security')?.checkSession();
    }, 300000);
    
    // Performance monitoring every minute
    setInterval(() => {
      this.performanceMonitor.collectMetrics();
    }, 60000);
    
    // Data backup every 10 minutes
    setInterval(() => {
      this.components.get('state')?.createBackup();
    }, 600000);
  }

  /**
   * Auto-save application state
   * @private
   */
  async autoSave() {
    try {
      const state = this.components.get('state');
      if (state.hasUnsavedChanges()) {
        await state.save();
        console.log('­ƒÆ¥ Auto-save completed');
      }
    } catch (error) {
      console.warn('Auto-save failed:', error);
    }
  }

  /**
   * Handle application errors
   * @param {Error} error - The error object
   * @param {string} type - Error type/category
   * @param {object} context - Additional error context
   */
  handleError(error, type = 'UNKNOWN_ERROR', context = {}) {
    const errorHandler = this.components.get('errorHandler');
    const notifications = this.components.get('notifications');
    
    if (errorHandler) {
      errorHandler.handleError(error, type, context);
    } else {
      console.error(`[${type}]`, error, context);
    }
    
    // Show user-friendly error message
    if (notifications) {
      const userMessage = this.getUserFriendlyErrorMessage(error, type);
      notifications.show(userMessage, 'error');
    }
    
    // Emit error event for other components
    this.eventBus.emit('app:error', { error, type, context });
  }

  /**
   * Get user-friendly error message
   * @param {Error} error - The error object
   * @param {string} type - Error type
   * @returns {string} User-friendly message
   */
  getUserFriendlyErrorMessage(error, type) {
    const messages = {
      'INITIALIZATION_ERROR': 'Applikationen kunde inte startas. Ladda om sidan.',
      'NETWORK_ERROR': 'N├ñtverksfel. Kontrollera din internetanslutning.',
      'STORAGE_ERROR': 'Fel vid sparande av data. Kontrollera lagringsutrymmet.',
      'VALIDATION_ERROR': 'Ogiltiga data uppt├ñckta. Kontrollera dina inmatningar.',
      'SECURITY_VIOLATION': 'S├ñkerhetsvarning uppt├ñckt. Kontakta administrat├Âren.',
      'UNKNOWN_ERROR': 'Ett ov├ñntat fel intr├ñffade. F├Ârs├Âk igen.'
    };
    
    return messages[type] || messages['UNKNOWN_ERROR'];
  }

  /**
   * Handle page before unload
   * @param {BeforeUnloadEvent} event
   */
  handleBeforeUnload(event) {
    const state = this.components.get('state');
    
    if (state?.hasUnsavedChanges()) {
      const message = 'Du har osparade ├ñndringar. ├är du s├ñker p├Ñ att du vill l├ñmna sidan?';
      event.returnValue = message;
      return message;
    }
  }

  /**
   * Handle page visibility change
   */
  handleVisibilityChange() {
    if (document.hidden) {
      // Page is hidden - pause non-critical operations
      this.eventBus.emit('app:hidden');
      this.autoSave(); // Save before hiding
    } else {
      // Page is visible - resume operations
      this.eventBus.emit('app:visible');
      this.components.get('security')?.checkSession();
    }
  }

  /**
   * Gracefully shutdown the application
   */
  async shutdown() {
    console.log('­ƒöä Shutting down CRM Application...');
    
    try {
      // Save any unsaved data
      await this.autoSave();
      
      // Cleanup components in reverse order
      for (const [name, component] of Array.from(this.components.entries()).reverse()) {
        try {
          if (typeof component.destroy === 'function') {
            await component.destroy();
          }
        } catch (error) {
          console.warn(`Failed to cleanup component ${name}:`, error);
        }
      }
      
      // Remove event listeners
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      
      // Clear components
      this.components.clear();
      
      this.isInitialized = false;
      
      console.log('Ô£à Application shutdown complete');
      
    } catch (error) {
      console.error('ÔØî Error during shutdown:', error);
    }
  }

  /**
   * Get application information
   * @returns {object} Application info
   */
  getInfo() {
    return {
      version: AppConfig.VERSION,
      environment: AppConfig.ENVIRONMENT,
      initialized: this.isInitialized,
      components: Array.from(this.components.keys()),
      performance: this.performanceMonitor.getMetrics(),
      state: this.components.get('state')?.getInfo() || null
    };
  }

  /**
   * Get component instance
   * @param {string} name - Component name
   * @returns {object|null} Component instance
   */
  getComponent(name) {
    return this.components.get(name) || null;
  }
}

// Initialize and start the application
const app = new CRMApplication();

// Make app available globally for debugging
window.CRMApp = app;

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.initialize());
} else {
  app.initialize();
}

// Export for modules
export default app;
