// Error Handler - Professional Error Management
// Comprehensive error handling with reporting, logging, and user feedback

import { AppConfig } from '../config/AppConfig.js';

/**
 * ErrorHandler Class - Centralized error management
 * Handles errors with proper logging, reporting, and user feedback
 */
export class ErrorHandler {
  constructor(options = {}) {
    this.options = {
      reportingEnabled: options.reportingEnabled || false,
      logLevel: options.logLevel || 'error',
      maxErrorHistory: options.maxErrorHistory || 100,
      enableStackTrace: options.enableStackTrace !== false,
      enableUserFeedback: options.enableUserFeedback !== false,
      autoReport: options.autoReport || false,
      ...options
    };
    
    this.errorHistory = [];
    this.errorCounts = new Map();
    this.eventBus = options.eventBus || null;
    this.reportingService = options.reportingService || null;
    
    // Error categories
    this.errorCategories = {
      VALIDATION: { severity: 'low', userMessage: 'Valideringsfel i indata' },
      NETWORK: { severity: 'medium', userMessage: 'Nätverksfel. Kontrollera anslutningen.' },
      STORAGE: { severity: 'medium', userMessage: 'Fel vid sparande av data' },
      SECURITY: { severity: 'high', userMessage: 'Säkerhetsvarning upptäckt' },
      AUTHENTICATION: { severity: 'medium', userMessage: 'Autentiseringsfel. Logga in igen.' },
      AUTHORIZATION: { severity: 'medium', userMessage: 'Otillräcklig behörighet' },
      SYSTEM: { severity: 'high', userMessage: 'Systemfel inträffade' },
      USER: { severity: 'low', userMessage: 'Användarfel' },
      EXTERNAL: { severity: 'medium', userMessage: 'Extern tjänst otillgänglig' },
      UNKNOWN: { severity: 'medium', userMessage: 'Ett oväntat fel inträffade' }
    };
    
    this.initializeErrorReporting();
  }
  
  /**
   * Handle an error
   * @param {Error|string} error - Error object or message
   * @param {string} category - Error category
   * @param {object} context - Additional context
   * @returns {object} Error report
   */
  handleError(error, category = 'UNKNOWN', context = {}) {
    const errorReport = this.createErrorReport(error, category, context);
    
    // Log the error
    this.logError(errorReport);
    
    // Add to history
    this.addToHistory(errorReport);
    
    // Update error counts
    this.updateErrorCounts(errorReport);
    
    // Report if enabled
    if (this.shouldReport(errorReport)) {
      this.reportError(errorReport);
    }
    
    // Emit event
    if (this.eventBus) {
      this.eventBus.emit('error:handled', errorReport);
    }
    
    return errorReport;
  }
  
  /**
   * Create structured error report
   * @param {Error|string} error - Error object or message
   * @param {string} category - Error category
   * @param {object} context - Additional context
   * @returns {object} Error report
   * @private
   */
  createErrorReport(error, category, context) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const categoryInfo = this.errorCategories[category] || this.errorCategories.UNKNOWN;
    
    return {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      message: errorObj.message,
      category,
      severity: categoryInfo.severity,
      userMessage: categoryInfo.userMessage,
      stack: this.options.enableStackTrace ? errorObj.stack : null,
      name: errorObj.name,
      code: errorObj.code || null,
      context: {
        url: typeof window !== 'undefined' ? window.location.href : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        timestamp: Date.now(),
        userId: context.userId || null,
        sessionId: context.sessionId || null,
        component: context.component || null,
        action: context.action || null,
        ...context
      },
      environment: {
        version: AppConfig.VERSION,
        environment: AppConfig.ENVIRONMENT,
        locale: AppConfig.LOCALE,
        features: Object.keys(AppConfig.FEATURES).filter(f => AppConfig.FEATURES[f])
      }
    };
  }
  
  /**
   * Log error based on severity and log level
   * @param {object} errorReport - Error report
   * @private
   */
  logError(errorReport) {
    const logLevel = AppConfig.LOG_LEVELS[this.options.logLevel] || 0;
    const shouldLog = this.shouldLogError(errorReport, logLevel);
    
    if (!shouldLog) return;
    
    const logData = {
      id: errorReport.id,
      category: errorReport.category,
      severity: errorReport.severity,
      message: errorReport.message,
      context: errorReport.context
    };
    
    switch (errorReport.severity) {
      case 'high':
        console.error('🚨 [HIGH SEVERITY]', logData);
        if (errorReport.stack) console.error('Stack:', errorReport.stack);
        break;
      case 'medium':
        console.warn('⚠️ [MEDIUM SEVERITY]', logData);
        break;
      case 'low':
        console.log('ℹ️ [LOW SEVERITY]', logData);
        break;
      default:
        console.log('📝 [ERROR]', logData);
    }
  }
  
  /**
   * Determine if error should be logged
   * @param {object} errorReport - Error report
   * @param {number} logLevel - Current log level
   * @returns {boolean} Should log
   * @private
   */
  shouldLogError(errorReport, logLevel) {
    const severityLevels = { low: 0, medium: 1, high: 2 };
    const errorLevel = severityLevels[errorReport.severity] || 1;
    
    return errorLevel >= logLevel;
  }
  
  /**
   * Add error to history
   * @param {object} errorReport - Error report
   * @private
   */
  addToHistory(errorReport) {
    this.errorHistory.push(errorReport);
    
    // Limit history size
    if (this.errorHistory.length > this.options.maxErrorHistory) {
      this.errorHistory.shift();
    }
  }
  
  /**
   * Update error count statistics
   * @param {object} errorReport - Error report
   * @private
   */
  updateErrorCounts(errorReport) {
    const key = `${errorReport.category}:${errorReport.message}`;
    const current = this.errorCounts.get(key) || { count: 0, firstSeen: errorReport.timestamp };
    
    this.errorCounts.set(key, {
      ...current,
      count: current.count + 1,
      lastSeen: errorReport.timestamp,
      severity: errorReport.severity
    });
  }
  
  /**
   * Determine if error should be reported
   * @param {object} errorReport - Error report
   * @returns {boolean} Should report
   * @private
   */
  shouldReport(errorReport) {
    if (!this.options.reportingEnabled) return false;
    if (!this.reportingService) return false;
    
    // Don't report in development unless explicitly enabled
    if (AppConfig.ENVIRONMENT === 'development' && !this.options.autoReport) {
      return false;
    }
    
    // Always report high severity errors
    if (errorReport.severity === 'high') return true;
    
    // Rate limit reporting for repeated errors
    const key = `${errorReport.category}:${errorReport.message}`;
    const errorCount = this.errorCounts.get(key);
    
    if (errorCount && errorCount.count > 5) {
      return false; // Don't spam reports for repeated errors
    }
    
    return true;
  }
  
  /**
   * Report error to external service
   * @param {object} errorReport - Error report
   * @private
   */
  async reportError(errorReport) {
    try {
      if (this.reportingService) {
        await this.reportingService.report(errorReport);
      } else {
        // Fallback: log to console
        console.log('📊 Error Report:', errorReport);
      }
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }
  
  /**
   * Get error statistics
   * @returns {object} Error statistics
   */
  getStats() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentErrors = this.errorHistory.filter(e => new Date(e.timestamp) > oneHourAgo);
    const dailyErrors = this.errorHistory.filter(e => new Date(e.timestamp) > oneDayAgo);
    
    const errorsByCategory = {};
    const errorsBySeverity = { low: 0, medium: 0, high: 0 };
    
    this.errorHistory.forEach(error => {
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    });
    
    return {
      total: this.errorHistory.length,
      recentCount: recentErrors.length,
      dailyCount: dailyErrors.length,
      byCategory: errorsByCategory,
      bySeverity: errorsBySeverity,
      mostCommon: this.getMostCommonErrors(5),
      healthScore: this.calculateHealthScore()
    };
  }
  
  /**
   * Get most common errors
   * @param {number} limit - Number of errors to return
   * @returns {Array} Most common errors
   */
  getMostCommonErrors(limit = 10) {
    return Array.from(this.errorCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([key, data]) => ({
        error: key,
        count: data.count,
        severity: data.severity,
        firstSeen: data.firstSeen,
        lastSeen: data.lastSeen
      }));
  }
  
  /**
   * Calculate application health score based on errors
   * @returns {number} Health score (0-100)
   */
  calculateHealthScore() {
    if (this.errorHistory.length === 0) return 100;
    
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentErrors = this.errorHistory.filter(e => new Date(e.timestamp) > oneHourAgo);
    
    // Penalty based on recent errors and severity
    let penalty = 0;
    recentErrors.forEach(error => {
      switch (error.severity) {
        case 'high': penalty += 20; break;
        case 'medium': penalty += 10; break;
        case 'low': penalty += 5; break;
      }
    });
    
    return Math.max(0, 100 - penalty);
  }
  
  /**
   * Get error history with filtering
   * @param {object} filters - Filter options
   * @returns {Array} Filtered error history
   */
  getHistory(filters = {}) {
    let history = [...this.errorHistory];
    
    if (filters.category) {
      history = history.filter(e => e.category === filters.category);
    }
    
    if (filters.severity) {
      history = history.filter(e => e.severity === filters.severity);
    }
    
    if (filters.since) {
      const since = new Date(filters.since);
      history = history.filter(e => new Date(e.timestamp) >= since);
    }
    
    if (filters.limit) {
      history = history.slice(-filters.limit);
    }
    
    return history;
  }
  
  /**
   * Clear error history
   * @param {object} filters - Optional filters for selective clearing
   */
  clearHistory(filters = {}) {
    if (Object.keys(filters).length === 0) {
      this.errorHistory = [];
      this.errorCounts.clear();
    } else {
      // Selective clearing based on filters
      const toKeep = this.errorHistory.filter(error => {
        if (filters.category && error.category === filters.category) return false;
        if (filters.severity && error.severity === filters.severity) return false;
        if (filters.before && new Date(error.timestamp) < new Date(filters.before)) return false;
        return true;
      });
      
      this.errorHistory = toKeep;
      
      // Rebuild error counts
      this.errorCounts.clear();
      toKeep.forEach(error => this.updateErrorCounts(error));
    }
    
    if (this.eventBus) {
      this.eventBus.emit('error:history-cleared', filters);
    }
  }
  
  /**
   * Create user-friendly error notification
   * @param {object} errorReport - Error report
   * @returns {object} Notification data
   */
  createUserNotification(errorReport) {
    return {
      type: 'error',
      title: 'Fel inträffade',
      message: errorReport.userMessage,
      errorId: errorReport.id,
      severity: errorReport.severity,
      actions: this.getSuggestedActions(errorReport),
      duration: errorReport.severity === 'high' ? 0 : 5000 // High severity errors stay visible
    };
  }
  
  /**
   * Get suggested actions for error recovery
   * @param {object} errorReport - Error report
   * @returns {Array} Suggested actions
   * @private
   */
  getSuggestedActions(errorReport) {
    const actions = [];
    
    switch (errorReport.category) {
      case 'NETWORK':
        actions.push(
          { text: 'Försök igen', action: 'retry' },
          { text: 'Kontrollera anslutning', action: 'check-connection' }
        );
        break;
      case 'VALIDATION':
        actions.push(
          { text: 'Kontrollera indata', action: 'validate-input' },
          { text: 'Återställ formulär', action: 'reset-form' }
        );
        break;
      case 'STORAGE':
        actions.push(
          { text: 'Försök spara igen', action: 'retry-save' },
          { text: 'Kontrollera lagringsutrymme', action: 'check-storage' }
        );
        break;
      case 'AUTHENTICATION':
        actions.push(
          { text: 'Logga in igen', action: 'login' },
          { text: 'Återställ session', action: 'reset-session' }
        );
        break;
      default:
        actions.push(
          { text: 'Ladda om sidan', action: 'reload' },
          { text: 'Rapportera fel', action: 'report' }
        );
    }
    
    return actions;
  }
  
  /**
   * Initialize error reporting service
   * @private
   */
  initializeErrorReporting() {
    // Set up console error capture in production
    if (AppConfig.ENVIRONMENT === 'production') {
      const originalConsoleError = console.error;
      console.error = (...args) => {
        originalConsoleError.apply(console, args);
        
        // Handle console.error calls as errors
        if (args.length > 0 && typeof args[0] === 'string') {
          this.handleError(new Error(args[0]), 'SYSTEM', { source: 'console.error' });
        }
      };
    }
  }
  
  /**
   * Generate unique error ID
   * @returns {string} Error ID
   * @private
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }
  
  /**
   * Destroy error handler and clean up
   */
  destroy() {
    this.errorHistory = [];
    this.errorCounts.clear();
    this.eventBus = null;
    this.reportingService = null;
  }
}

export default ErrorHandler;