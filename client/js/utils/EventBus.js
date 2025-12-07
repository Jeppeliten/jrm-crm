// Event Bus - Centralized Event Management
// Professional event system with namespacing, filtering, and debugging

/**
 * EventBus Class - Centralized event management system
 * Provides publish/subscribe pattern with advanced features
 */
export class EventBus {
  constructor(options = {}) {
    this.events = new Map();
    this.eventHistory = [];
    this.middleware = [];
    this.namespaces = new Set();
    
    this.options = {
      maxHistorySize: options.maxHistorySize || 1000,
      enableHistory: options.enableHistory !== false,
      enableDebugging: options.enableDebugging || false,
      wildcardSupport: options.wildcardSupport !== false,
      ...options
    };
    
    // Bind methods
    this.emit = this.emit.bind(this);
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);
    this.once = this.once.bind(this);
    
    if (this.options.enableDebugging) {
      this.setupDebugging();
    }
  }
  
  /**
   * Subscribe to an event
   * @param {string} eventName - Event name (supports namespaces like 'app:user:login')
   * @param {Function} callback - Event callback
   * @param {object} options - Subscription options
   * @returns {Function} Unsubscribe function
   */
  on(eventName, callback, options = {}) {
    if (typeof eventName !== 'string' || typeof callback !== 'function') {
      throw new Error('EventBus.on: eventName must be string, callback must be function');
    }
    
    const subscription = {
      id: this.generateId(),
      callback,
      once: false,
      priority: options.priority || 0,
      namespace: this.extractNamespace(eventName),
      filter: options.filter || null,
      context: options.context || null,
      created: new Date()
    };
    
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }
    
    const subscribers = this.events.get(eventName);
    subscribers.push(subscription);
    
    // Sort by priority (higher priority first)
    subscribers.sort((a, b) => b.priority - a.priority);
    
    // Track namespace
    if (subscription.namespace) {
      this.namespaces.add(subscription.namespace);
    }
    
    this.debugLog('subscribed', { eventName, subscriptionId: subscription.id, options });
    
    // Return unsubscribe function
    return () => this.off(eventName, subscription.id);
  }
  
  /**
   * Subscribe to an event once
   * @param {string} eventName - Event name
   * @param {Function} callback - Event callback
   * @param {object} options - Subscription options
   * @returns {Function} Unsubscribe function
   */
  once(eventName, callback, options = {}) {
    const wrappedCallback = (...args) => {
      callback(...args);
      this.off(eventName, subscription.id);
    };
    
    const subscription = {
      id: this.generateId(),
      callback: wrappedCallback,
      once: true,
      priority: options.priority || 0,
      namespace: this.extractNamespace(eventName),
      filter: options.filter || null,
      context: options.context || null,
      created: new Date()
    };
    
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }
    
    const subscribers = this.events.get(eventName);
    subscribers.push(subscription);
    subscribers.sort((a, b) => b.priority - a.priority);
    
    this.debugLog('subscribed-once', { eventName, subscriptionId: subscription.id, options });
    
    return () => this.off(eventName, subscription.id);
  }
  
  /**
   * Unsubscribe from event
   * @param {string} eventName - Event name
   * @param {string|Function} callbackOrId - Callback function or subscription ID
   */
  off(eventName, callbackOrId) {
    if (!this.events.has(eventName)) {
      return;
    }
    
    const subscribers = this.events.get(eventName);
    const initialLength = subscribers.length;
    
    if (typeof callbackOrId === 'string') {
      // Remove by subscription ID
      const index = subscribers.findIndex(sub => sub.id === callbackOrId);
      if (index !== -1) {
        subscribers.splice(index, 1);
      }
    } else if (typeof callbackOrId === 'function') {
      // Remove by callback function
      const index = subscribers.findIndex(sub => sub.callback === callbackOrId);
      if (index !== -1) {
        subscribers.splice(index, 1);
      }
    } else {
      // Remove all subscribers
      subscribers.length = 0;
    }
    
    // Clean up empty event arrays
    if (subscribers.length === 0) {
      this.events.delete(eventName);
    }
    
    const removedCount = initialLength - subscribers.length;
    if (removedCount > 0) {
      this.debugLog('unsubscribed', { eventName, removedCount });
    }
  }
  
  /**
   * Emit an event
   * @param {string} eventName - Event name
   * @param {*} data - Event data
   * @param {object} options - Emit options
   * @returns {Promise<Array>} Array of callback results
   */
  async emit(eventName, data, options = {}) {
    const event = {
      name: eventName,
      data,
      timestamp: new Date(),
      id: this.generateId(),
      namespace: this.extractNamespace(eventName),
      ...options
    };
    
    // Add to history
    if (this.options.enableHistory) {
      this.addToHistory(event);
    }
    
    // Process middleware
    for (const middleware of this.middleware) {
      try {
        await middleware(event);
      } catch (error) {
        console.error('EventBus middleware error:', error);
      }
    }
    
    const results = [];
    const subscribers = this.getSubscribers(eventName);
    
    this.debugLog('emitting', { 
      eventName, 
      subscriberCount: subscribers.length, 
      data: this.options.enableDebugging ? data : '[data]' 
    });
    
    // Execute callbacks
    for (const subscription of subscribers) {
      try {
        // Apply filter if present
        if (subscription.filter && !subscription.filter(event)) {
          continue;
        }
        
        // Execute callback with proper context
        const context = subscription.context || null;
        const result = await subscription.callback.call(context, data, event);
        results.push(result);
        
      } catch (error) {
        console.error(`EventBus callback error for ${eventName}:`, error);
        results.push({ error });
      }
    }
    
    // Handle wildcard subscribers
    if (this.options.wildcardSupport) {
      const wildcardResults = await this.emitWildcard(event);
      results.push(...wildcardResults);
    }
    
    this.debugLog('emitted', { eventName, resultCount: results.length });
    
    return results;
  }
  
  /**
   * Get subscribers for an event
   * @param {string} eventName - Event name
   * @returns {Array} Array of subscribers
   */
  getSubscribers(eventName) {
    return this.events.get(eventName) || [];
  }
  
  /**
   * Handle wildcard event emission
   * @param {object} event - Event object
   * @returns {Promise<Array>} Array of results
   * @private
   */
  async emitWildcard(event) {
    const results = [];
    const eventParts = event.name.split(':');
    
    // Check for wildcard subscribers
    for (const [pattern, subscribers] of this.events.entries()) {
      if (pattern.includes('*') && this.matchesWildcard(event.name, pattern)) {
        for (const subscription of subscribers) {
          try {
            if (subscription.filter && !subscription.filter(event)) {
              continue;
            }
            
            const context = subscription.context || null;
            const result = await subscription.callback.call(context, event.data, event);
            results.push(result);
            
          } catch (error) {
            console.error(`EventBus wildcard callback error for ${pattern}:`, error);
            results.push({ error });
          }
        }
      }
    }
    
    return results;
  }
  
  /**
   * Check if event name matches wildcard pattern
   * @param {string} eventName - Event name
   * @param {string} pattern - Wildcard pattern
   * @returns {boolean} Matches pattern
   * @private
   */
  matchesWildcard(eventName, pattern) {
    const eventParts = eventName.split(':');
    const patternParts = pattern.split(':');
    
    if (patternParts.length > eventParts.length) {
      return false;
    }
    
    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const eventPart = eventParts[i];
      
      if (patternPart === '*') {
        continue; // Wildcard matches anything
      }
      
      if (patternPart !== eventPart) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Add middleware
   * @param {Function} middleware - Middleware function
   */
  use(middleware) {
    if (typeof middleware !== 'function') {
      throw new Error('EventBus middleware must be a function');
    }
    
    this.middleware.push(middleware);
  }
  
  /**
   * Remove middleware
   * @param {Function} middleware - Middleware function to remove
   */
  removeMiddleware(middleware) {
    const index = this.middleware.indexOf(middleware);
    if (index !== -1) {
      this.middleware.splice(index, 1);
    }
  }
  
  /**
   * Clear all subscribers for a namespace
   * @param {string} namespace - Namespace to clear
   */
  clearNamespace(namespace) {
    const eventsToRemove = [];
    
    for (const [eventName, subscribers] of this.events.entries()) {
      const remainingSubscribers = subscribers.filter(
        sub => sub.namespace !== namespace
      );
      
      if (remainingSubscribers.length === 0) {
        eventsToRemove.push(eventName);
      } else {
        this.events.set(eventName, remainingSubscribers);
      }
    }
    
    // Remove empty events
    eventsToRemove.forEach(eventName => {
      this.events.delete(eventName);
    });
    
    this.namespaces.delete(namespace);
    
    this.debugLog('namespace-cleared', { namespace, eventsRemoved: eventsToRemove.length });
  }
  
  /**
   * Get event statistics
   * @returns {object} Event statistics
   */
  getStats() {
    const stats = {
      totalEvents: this.events.size,
      totalSubscribers: 0,
      namespaces: Array.from(this.namespaces),
      eventNames: Array.from(this.events.keys()),
      historySize: this.eventHistory.length,
      middleware: this.middleware.length
    };
    
    for (const subscribers of this.events.values()) {
      stats.totalSubscribers += subscribers.length;
    }
    
    return stats;
  }
  
  /**
   * Get event history
   * @param {number} limit - Maximum number of events to return
   * @returns {Array} Event history
   */
  getHistory(limit = 100) {
    return this.eventHistory.slice(-limit);
  }
  
  /**
   * Clear event history
   */
  clearHistory() {
    this.eventHistory = [];
    this.debugLog('history-cleared');
  }
  
  /**
   * Destroy event bus and clean up
   */
  destroy() {
    this.events.clear();
    this.eventHistory = [];
    this.middleware = [];
    this.namespaces.clear();
    
    this.debugLog('destroyed');
  }
  
  // Utility methods
  
  /**
   * Generate unique ID
   * @returns {string} Unique ID
   * @private
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Extract namespace from event name
   * @param {string} eventName - Event name
   * @returns {string|null} Namespace
   * @private
   */
  extractNamespace(eventName) {
    const parts = eventName.split(':');
    return parts.length > 1 ? parts[0] : null;
  }
  
  /**
   * Add event to history
   * @param {object} event - Event object
   * @private
   */
  addToHistory(event) {
    this.eventHistory.push({
      ...event,
      data: this.options.enableDebugging ? event.data : '[data]' // Limit data in history
    });
    
    // Limit history size
    if (this.eventHistory.length > this.options.maxHistorySize) {
      this.eventHistory.shift();
    }
  }
  
  /**
   * Debug logging
   * @param {string} action - Action name
   * @param {object} data - Debug data
   * @private
   */
  debugLog(action, data = {}) {
    if (this.options.enableDebugging) {
      console.log(`[EventBus:${action}]`, data);
    }
  }
  
  /**
   * Set up debugging helpers
   * @private
   */
  setupDebugging() {
    // Make event bus available globally for debugging
    if (typeof window !== 'undefined') {
      window.EventBus = this;
    }
    
    // Add performance monitoring
    this.use(async (event) => {
      const start = performance.now();
      event.performanceStart = start;
    });
  }
}

export default EventBus;