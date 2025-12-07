// Error Handling Middleware
// Centraliserad felhantering med säkerhet och loggning

const { SECURITY_CONFIG } = require('../config/security');

class ErrorHandler {
  
  // Main error handling middleware
  static handle(err, req, res, next) {
    // Log the error
    this.logError(err, req);

    // Determine error type and response
    const errorResponse = this.createErrorResponse(err, req);
    
    // Send response
    res.status(errorResponse.status).json(errorResponse.body);
  }

  // 404 handler
  static notFound(req, res, next) {
    const error = new Error(`Resursen hittades inte: ${req.originalUrl}`);
    error.status = 404;
    error.type = 'NOT_FOUND';
    next(error);
  }

  // Async wrapper for route handlers
  static asyncWrapper(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Create standardized error response
  static createErrorResponse(err, req) {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const errorId = this.generateErrorId();

    // Default error response
    let status = err.status || err.statusCode || 500;
    let message = 'Ett internt fel inträffade';
    let code = 'INTERNAL_SERVER_ERROR';
    let details = null;

    // Handle specific error types
    switch (err.type || err.name) {
      case 'ValidationError':
        status = 400;
        message = 'Valideringsfel i indata';
        code = 'VALIDATION_ERROR';
        details = isDevelopment ? err.details : null;
        break;

      case 'AuthenticationError':
        status = 401;
        message = 'Autentisering krävs';
        code = 'AUTHENTICATION_REQUIRED';
        break;

      case 'AuthorizationError':
        status = 403;
        message = 'Otillräcklig behörighet';
        code = 'INSUFFICIENT_PERMISSIONS';
        break;

      case 'NOT_FOUND':
        status = 404;
        message = err.message || 'Resursen hittades inte';
        code = 'RESOURCE_NOT_FOUND';
        break;

      case 'ConflictError':
        status = 409;
        message = 'Konflikt med befintlig resurs';
        code = 'RESOURCE_CONFLICT';
        details = isDevelopment ? err.details : null;
        break;

      case 'RateLimitError':
        status = 429;
        message = 'För många förfrågningar';
        code = 'RATE_LIMIT_EXCEEDED';
        details = { retryAfter: err.retryAfter };
        break;

      case 'PayloadTooLargeError':
        status = 413;
        message = 'Uppladdningen är för stor';
        code = 'PAYLOAD_TOO_LARGE';
        break;

      case 'DatabaseError':
        status = 500;
        message = 'Databasfel inträffade';
        code = 'DATABASE_ERROR';
        details = isDevelopment ? err.details : null;
        break;

      case 'ExternalServiceError':
        status = 502;
        message = 'Extern tjänst otillgänglig';
        code = 'EXTERNAL_SERVICE_ERROR';
        break;

      case 'CsrfError':
        status = 403;
        message = 'Ogiltig säkerhetstoken (CSRF)';
        code = 'CSRF_TOKEN_INVALID';
        break;

      case 'SessionError':
        status = 401;
        message = 'Session ogiltig eller utgången';
        code = 'SESSION_INVALID';
        break;

      case 'FileUploadError':
        status = 400;
        message = 'Fel vid filuppladdning';
        code = 'FILE_UPLOAD_ERROR';
        details = isDevelopment ? err.details : null;
        break;

      default:
        // Check for common Node.js errors
        if (err.code === 'ENOENT') {
          status = 404;
          message = 'Filen hittades inte';
          code = 'FILE_NOT_FOUND';
        } else if (err.code === 'EACCES') {
          status = 403;
          message = 'Åtkomst nekad';
          code = 'ACCESS_DENIED';
        } else if (err.code === 'EMFILE' || err.code === 'ENFILE') {
          status = 503;
          message = 'Tjänsten är tillfälligt otillgänglig';
          code = 'SERVICE_UNAVAILABLE';
        }
        break;
    }

    // Security: Don't expose sensitive information
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /database/i,
      /connection/i
    ];

    if (!isDevelopment && sensitivePatterns.some(pattern => pattern.test(err.message || ''))) {
      message = 'Ett internt fel inträffade';
      details = null;
    }

    const response = {
      status,
      body: {
        error: true,
        code,
        message,
        errorId,
        timestamp: new Date().toISOString()
      }
    };

    // Add details in development or for client errors
    if (details && (isDevelopment || status < 500)) {
      response.body.details = details;
    }

    // Add stack trace in development
    if (isDevelopment && err.stack) {
      response.body.stack = err.stack;
    }

    return response;
  }

  // Log errors with appropriate level
  static logError(err, req) {
    const errorInfo = {
      errorId: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      level: this.getErrorLevel(err),
      message: err.message,
      stack: err.stack,
      type: err.type || err.name,
      status: err.status || err.statusCode,
      request: {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.session?.userId,
        sessionId: req.sessionID
      }
    };

    // Log to console (in production, this should go to proper logging service)
    if (errorInfo.level === 'error') {
      console.error('ERROR:', JSON.stringify(errorInfo, null, 2));
    } else if (errorInfo.level === 'warn') {
      console.warn('WARNING:', JSON.stringify(errorInfo, null, 2));
    } else {
      console.log('INFO:', JSON.stringify(errorInfo, null, 2));
    }

    // Write to error log file
    this.writeErrorLog(errorInfo);

    // Send alert for critical errors
    if (errorInfo.level === 'error' && process.env.NODE_ENV === 'production') {
      this.sendErrorAlert(errorInfo);
    }
  }

  // Determine error logging level
  static getErrorLevel(err) {
    const status = err.status || err.statusCode || 500;
    
    if (status >= 500) {
      return 'error';
    } else if (status >= 400) {
      return 'warn';
    } else {
      return 'info';
    }
  }

  // Generate unique error ID
  static generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Write error to log file
  static writeErrorLog(errorInfo) {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      const logFile = path.join(logDir, `error-${new Date().toISOString().split('T')[0]}.log`);
      const logLine = JSON.stringify(errorInfo) + '\n';
      
      fs.appendFileSync(logFile, logLine);
    } catch (writeError) {
      console.error('Failed to write error log:', writeError);
    }
  }

  // Send error alert (implement based on your alerting system)
  static sendErrorAlert(errorInfo) {
    // This could integrate with Slack, email, SMS, or monitoring services
    console.log('CRITICAL ERROR ALERT:', errorInfo.errorId);
    
    // Example: Send to monitoring service
    // monitoringService.sendAlert({
    //   level: 'critical',
    //   message: errorInfo.message,
    //   errorId: errorInfo.errorId,
    //   service: 'crm-api'
    // });
  }

  // Custom error classes
  static ValidationError(message, details = null) {
    const error = new Error(message);
    error.type = 'ValidationError';
    error.status = 400;
    error.details = details;
    return error;
  }

  static AuthenticationError(message = 'Autentisering krävs') {
    const error = new Error(message);
    error.type = 'AuthenticationError';
    error.status = 401;
    return error;
  }

  static AuthorizationError(message = 'Otillräcklig behörighet') {
    const error = new Error(message);
    error.type = 'AuthorizationError';
    error.status = 403;
    return error;
  }

  static ConflictError(message, details = null) {
    const error = new Error(message);
    error.type = 'ConflictError';
    error.status = 409;
    error.details = details;
    return error;
  }

  static DatabaseError(message, details = null) {
    const error = new Error(message);
    error.type = 'DatabaseError';
    error.status = 500;
    error.details = details;
    return error;
  }

  static ExternalServiceError(message, service = null) {
    const error = new Error(message);
    error.type = 'ExternalServiceError';
    error.status = 502;
    error.service = service;
    return error;
  }

  static FileUploadError(message, details = null) {
    const error = new Error(message);
    error.type = 'FileUploadError';
    error.status = 400;
    error.details = details;
    return error;
  }

  // Graceful shutdown on uncaught exceptions
  static setupGlobalErrorHandlers() {
    process.on('uncaughtException', (err) => {
      console.error('UNCAUGHT EXCEPTION:', err);
      this.logError(err, { method: 'SYSTEM', url: 'uncaught', ip: 'system' });
      
      // Graceful shutdown
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
      
      const err = reason instanceof Error ? reason : new Error(reason);
      this.logError(err, { method: 'SYSTEM', url: 'unhandled-rejection', ip: 'system' });
      
      // Don't exit on unhandled rejections in production
      if (process.env.NODE_ENV === 'development') {
        process.exit(1);
      }
    });

    // Graceful shutdown on SIGTERM
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully...');
      // Add cleanup logic here
      process.exit(0);
    });

    // Graceful shutdown on SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully...');
      process.exit(0);
    });
  }

  // Health check with error tracking
  static getHealthStatus() {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const errorLogPath = path.join(process.cwd(), 'logs', `error-${today}.log`);
      
      let errorCount = 0;
      let criticalErrorCount = 0;
      
      if (fs.existsSync(errorLogPath)) {
        const logContent = fs.readFileSync(errorLogPath, 'utf8');
        const lines = logContent.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
          try {
            const logEntry = JSON.parse(line);
            if (logEntry.level === 'error') {
              errorCount++;
              if (logEntry.status >= 500) {
                criticalErrorCount++;
              }
            }
          } catch (e) {
            // Ignore malformed log lines
          }
        });
      }
      
      return {
        status: criticalErrorCount > 10 ? 'critical' : errorCount > 50 ? 'warning' : 'healthy',
        errors: {
          total: errorCount,
          critical: criticalErrorCount
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unknown',
        error: 'Failed to read error logs',
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = ErrorHandler;