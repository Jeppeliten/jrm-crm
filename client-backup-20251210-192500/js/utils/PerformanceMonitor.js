// Performance Monitor - Application Performance Tracking
// Comprehensive performance monitoring with metrics, alerts, and optimization insights

import { AppConfig } from '../config/AppConfig.js';

/**
 * PerformanceMonitor Class - Professional performance monitoring
 * Tracks metrics, identifies bottlenecks, and provides optimization insights
 */
export class PerformanceMonitor {
  constructor(options = {}) {
    this.options = {
      sampleRate: options.sampleRate || AppConfig.PERFORMANCE_SAMPLE_RATE,
      enableMemoryTracking: options.enableMemoryTracking !== false,
      enableNetworkTracking: options.enableNetworkTracking !== false,
      enableUserTimings: options.enableUserTimings !== false,
      alertThresholds: {
        slowOperation: 1000, // ms
        memoryUsage: 100, // MB
        networkLatency: 2000, // ms
        ...options.alertThresholds
      },
      bufferSize: options.bufferSize || 1000,
      ...options
    };
    
    this.metrics = {
      marks: new Map(),
      measures: new Map(),
      resources: [],
      memory: [],
      network: [],
      userActions: [],
      errors: []
    };
    
    this.observers = [];
    this.alerts = [];
    this.sessionStart = performance.now();
    
    this.initialize();
  }
  
  /**
   * Initialize performance monitoring
   * @private
   */
  initialize() {
    if (!this.isSupported()) {
      console.warn('Performance monitoring not fully supported in this browser');
      return;
    }
    
    // Set up observers
    this.setupPerformanceObservers();
    
    // Track initial metrics
    this.trackInitialMetrics();
    
    // Set up periodic collection
    this.startPeriodicCollection();
    
    console.log('📊 Performance monitoring initialized');
  }
  
  /**
   * Check if performance monitoring is supported
   * @returns {boolean} Is supported
   */
  isSupported() {
    return !!(
      typeof performance !== 'undefined' &&
      performance.mark &&
      performance.measure &&
      performance.getEntriesByType
    );
  }
  
  /**
   * Set up performance observers
   * @private
   */
  setupPerformanceObservers() {
    if (!window.PerformanceObserver) return;
    
    try {
      // Observe navigation timing
      const navigationObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          this.handleNavigationEntry(entry);
        });
      });
      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navigationObserver);
      
      // Observe resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          this.handleResourceEntry(entry);
        });
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);
      
      // Observe user timings
      if (this.options.enableUserTimings) {
        const userObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            this.handleUserEntry(entry);
          });
        });
        userObserver.observe({ entryTypes: ['mark', 'measure'] });
        this.observers.push(userObserver);
      }
      
      // Observe long tasks (if supported)
      if ('longtask' in PerformanceObserver.supportedEntryTypes) {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            this.handleLongTask(entry);
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      }
      
    } catch (error) {
      console.warn('Failed to set up performance observers:', error);
    }
  }
  
  /**
   * Track initial page metrics
   * @private
   */
  trackInitialMetrics() {
    // Track DOM ready state
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.mark('dom-content-loaded');
      });
    } else {
      this.mark('dom-content-loaded');
    }
    
    // Track window load
    if (document.readyState !== 'complete') {
      window.addEventListener('load', () => {
        this.mark('window-loaded');
        this.measure('initial-load', 'navigationStart', 'window-loaded');
      });
    }
    
    // Track first interaction
    const firstInteractionHandler = () => {
      this.mark('first-interaction');
      document.removeEventListener('click', firstInteractionHandler);
      document.removeEventListener('keydown', firstInteractionHandler);
      document.removeEventListener('scroll', firstInteractionHandler);
    };
    
    document.addEventListener('click', firstInteractionHandler);
    document.addEventListener('keydown', firstInteractionHandler);
    document.addEventListener('scroll', firstInteractionHandler);
  }
  
  /**
   * Start periodic metric collection
   * @private
   */
  startPeriodicCollection() {
    // Collect metrics every minute
    setInterval(() => {
      this.collectMetrics();
    }, 60000);
    
    // Collect memory usage every 30 seconds
    if (this.options.enableMemoryTracking) {
      setInterval(() => {
        this.collectMemoryMetrics();
      }, 30000);
    }
  }
  
  /**
   * Create a performance mark
   * @param {string} name - Mark name
   * @param {object} details - Additional details
   */
  mark(name, details = {}) {
    if (!this.isSupported()) return;
    
    const markData = {
      name,
      timestamp: performance.now(),
      details,
      sessionTime: performance.now() - this.sessionStart
    };
    
    // Create native performance mark
    performance.mark(name);
    
    // Store in our metrics
    this.metrics.marks.set(name, markData);
    
    this.debugLog('mark', markData);
  }
  
  /**
   * Create a performance measure
   * @param {string} name - Measure name
   * @param {string} startMark - Start mark name
   * @param {string} endMark - End mark name (optional, defaults to now)
   * @returns {object} Measure data
   */
  measure(name, startMark, endMark = null) {
    if (!this.isSupported()) return null;
    
    try {
      // Create native performance measure
      if (endMark) {
        performance.measure(name, startMark, endMark);
      } else {
        performance.measure(name, startMark);
      }
      
      // Get the measure
      const entries = performance.getEntriesByName(name, 'measure');
      const entry = entries[entries.length - 1];
      
      if (entry) {
        const measureData = {
          name,
          duration: entry.duration,
          startTime: entry.startTime,
          startMark,
          endMark,
          timestamp: Date.now()
        };
        
        this.metrics.measures.set(name, measureData);
        
        // Check for slow operations
        if (entry.duration > this.options.alertThresholds.slowOperation) {
          this.addAlert('slow-operation', `Slow operation detected: ${name} took ${entry.duration.toFixed(2)}ms`);
        }
        
        this.debugLog('measure', measureData);
        
        return measureData;
      }
    } catch (error) {
      console.warn(`Failed to create measure ${name}:`, error);
    }
    
    return null;
  }
  
  /**
   * Track user action performance
   * @param {string} action - Action name
   * @param {Function} callback - Action callback
   * @param {object} context - Additional context
   * @returns {Promise} Action result
   */
  async trackAction(action, callback, context = {}) {
    const startMark = `${action}-start`;
    const endMark = `${action}-end`;
    
    this.mark(startMark, { action, context });
    
    try {
      const result = await callback();
      
      this.mark(endMark, { action, context, success: true });
      this.measure(action, startMark, endMark);
      
      return result;
    } catch (error) {
      this.mark(endMark, { action, context, success: false, error: error.message });
      this.measure(action, startMark, endMark);
      
      throw error;
    }
  }
  
  /**
   * Collect current performance metrics
   * @returns {object} Current metrics
   */
  collectMetrics() {
    const metrics = {
      timestamp: Date.now(),
      session: {
        duration: performance.now() - this.sessionStart,
        marks: this.metrics.marks.size,
        measures: this.metrics.measures.size
      },
      timing: this.getTimingMetrics(),
      memory: this.getMemoryMetrics(),
      network: this.getNetworkMetrics(),
      resources: this.getResourceMetrics(),
      vitals: this.getWebVitals()
    };
    
    this.debugLog('metrics-collected', metrics);
    
    return metrics;
  }
  
  /**
   * Get timing metrics
   * @returns {object} Timing metrics
   * @private
   */
  getTimingMetrics() {
    const navigation = performance.getEntriesByType('navigation')[0];
    if (!navigation) return {};
    
    return {
      dns: navigation.domainLookupEnd - navigation.domainLookupStart,
      tcp: navigation.connectEnd - navigation.connectStart,
      request: navigation.responseStart - navigation.requestStart,
      response: navigation.responseEnd - navigation.responseStart,
      domProcessing: navigation.domComplete - navigation.domLoading,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      load: navigation.loadEventEnd - navigation.loadEventStart,
      total: navigation.loadEventEnd - navigation.navigationStart
    };
  }
  
  /**
   * Get memory metrics
   * @returns {object} Memory metrics
   * @private
   */
  getMemoryMetrics() {
    if (!this.options.enableMemoryTracking || !performance.memory) {
      return {};
    }
    
    const memory = {
      used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
      total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
    };
    
    // Check memory usage threshold
    if (memory.used > this.options.alertThresholds.memoryUsage) {
      this.addAlert('high-memory', `High memory usage: ${memory.used}MB`);
    }
    
    return memory;
  }
  
  /**
   * Get network metrics
   * @returns {object} Network metrics
   * @private
   */
  getNetworkMetrics() {
    if (!this.options.enableNetworkTracking) return {};
    
    const resources = performance.getEntriesByType('resource');
    const networkRequests = resources.filter(r => 
      r.name.startsWith('http') && r.responseEnd - r.requestStart > 0
    );
    
    if (networkRequests.length === 0) return {};
    
    const durations = networkRequests.map(r => r.responseEnd - r.requestStart);
    const average = durations.reduce((a, b) => a + b, 0) / durations.length;
    const slowRequests = durations.filter(d => d > this.options.alertThresholds.networkLatency);
    
    return {
      totalRequests: networkRequests.length,
      averageLatency: Math.round(average),
      slowRequests: slowRequests.length,
      minLatency: Math.min(...durations),
      maxLatency: Math.max(...durations)
    };
  }
  
  /**
   * Get resource metrics
   * @returns {object} Resource metrics
   * @private
   */
  getResourceMetrics() {
    const resources = performance.getEntriesByType('resource');
    
    const byType = {};
    let totalSize = 0;
    let totalDuration = 0;
    
    resources.forEach(resource => {
      const type = this.getResourceType(resource);
      byType[type] = byType[type] || { count: 0, size: 0, duration: 0 };
      byType[type].count++;
      
      if (resource.transferSize) {
        byType[type].size += resource.transferSize;
        totalSize += resource.transferSize;
      }
      
      const duration = resource.responseEnd - resource.requestStart;
      byType[type].duration += duration;
      totalDuration += duration;
    });
    
    return {
      total: resources.length,
      totalSize: Math.round(totalSize / 1024), // KB
      totalDuration: Math.round(totalDuration),
      byType
    };
  }
  
  /**
   * Get Web Vitals metrics
   * @returns {object} Web Vitals
   * @private
   */
  getWebVitals() {
    const vitals = {};
    
    // First Contentful Paint (FCP)
    const fcpEntries = performance.getEntriesByName('first-contentful-paint');
    if (fcpEntries.length > 0) {
      vitals.fcp = Math.round(fcpEntries[0].startTime);
    }
    
    // Largest Contentful Paint (LCP) - would need observer
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    if (lcpEntries.length > 0) {
      vitals.lcp = Math.round(lcpEntries[lcpEntries.length - 1].startTime);
    }
    
    // Cumulative Layout Shift (CLS) - would need observer
    const clsEntries = performance.getEntriesByType('layout-shift');
    if (clsEntries.length > 0) {
      vitals.cls = clsEntries.reduce((sum, entry) => sum + entry.value, 0);
    }
    
    return vitals;
  }
  
  /**
   * Collect memory metrics
   * @private
   */
  collectMemoryMetrics() {
    if (!this.options.enableMemoryTracking || !performance.memory) return;
    
    const memoryData = {
      timestamp: Date.now(),
      ...this.getMemoryMetrics()
    };
    
    this.metrics.memory.push(memoryData);
    
    // Limit buffer size
    if (this.metrics.memory.length > this.options.bufferSize) {
      this.metrics.memory.shift();
    }
  }
  
  /**
   * Handle navigation entry
   * @param {PerformanceNavigationTiming} entry - Navigation entry
   * @private
   */
  handleNavigationEntry(entry) {
    this.debugLog('navigation', {
      type: entry.type,
      redirectCount: entry.redirectCount,
      duration: entry.loadEventEnd - entry.navigationStart
    });
  }
  
  /**
   * Handle resource entry
   * @param {PerformanceResourceTiming} entry - Resource entry
   * @private
   */
  handleResourceEntry(entry) {
    const resourceData = {
      name: entry.name,
      type: this.getResourceType(entry),
      duration: entry.responseEnd - entry.requestStart,
      size: entry.transferSize || 0,
      cached: entry.transferSize === 0 && entry.decodedBodySize > 0
    };
    
    this.metrics.resources.push(resourceData);
    
    // Limit buffer size
    if (this.metrics.resources.length > this.options.bufferSize) {
      this.metrics.resources.shift();
    }
    
    this.debugLog('resource', resourceData);
  }
  
  /**
   * Handle user timing entry
   * @param {PerformanceEntry} entry - User timing entry
   * @private
   */
  handleUserEntry(entry) {
    this.debugLog('user-timing', {
      name: entry.name,
      type: entry.entryType,
      duration: entry.duration || 0
    });
  }
  
  /**
   * Handle long task
   * @param {PerformanceLongTaskTiming} entry - Long task entry
   * @private
   */
  handleLongTask(entry) {
    const taskData = {
      duration: entry.duration,
      startTime: entry.startTime,
      attribution: entry.attribution || []
    };
    
    this.addAlert('long-task', `Long task detected: ${entry.duration.toFixed(2)}ms`);
    this.debugLog('long-task', taskData);
  }
  
  /**
   * Get resource type from entry
   * @param {PerformanceResourceTiming} entry - Resource entry
   * @returns {string} Resource type
   * @private
   */
  getResourceType(entry) {
    if (entry.initiatorType) return entry.initiatorType;
    
    const url = entry.name;
    if (url.includes('.js')) return 'script';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) return 'image';
    if (url.includes('.woff') || url.includes('.ttf')) return 'font';
    
    return 'other';
  }
  
  /**
   * Add performance alert
   * @param {string} type - Alert type
   * @param {string} message - Alert message
   * @private
   */
  addAlert(type, message) {
    const alert = {
      type,
      message,
      timestamp: Date.now(),
      level: this.getAlertLevel(type)
    };
    
    this.alerts.push(alert);
    
    // Limit alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
    
    console.warn(`⚡ Performance Alert [${type}]:`, message);
  }
  
  /**
   * Get alert level
   * @param {string} type - Alert type
   * @returns {string} Alert level
   * @private
   */
  getAlertLevel(type) {
    const levels = {
      'slow-operation': 'warning',
      'high-memory': 'critical',
      'long-task': 'warning',
      'network-slow': 'warning'
    };
    
    return levels[type] || 'info';
  }
  
  /**
   * Get performance report
   * @returns {object} Performance report
   */
  getReport() {
    return {
      session: {
        duration: performance.now() - this.sessionStart,
        start: this.sessionStart
      },
      metrics: this.collectMetrics(),
      alerts: this.alerts,
      recommendations: this.generateRecommendations()
    };
  }
  
  /**
   * Generate performance recommendations
   * @returns {Array} Recommendations
   * @private
   */
  generateRecommendations() {
    const recommendations = [];
    const metrics = this.collectMetrics();
    
    // Check memory usage
    if (metrics.memory.used > 50) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: 'Hög minnesanvändning upptäckt. Överväg att optimera JavaScript-kod.',
        action: 'Analysera minnesläckor och optimera komponenters livscykel'
      });
    }
    
    // Check network performance
    if (metrics.network.averageLatency > 1000) {
      recommendations.push({
        type: 'network',
        priority: 'high',
        message: 'Långsam nätverksprestanda. Optimera API-anrop.',
        action: 'Implementera caching och reducera antalet HTTP-förfrågningar'
      });
    }
    
    // Check long tasks
    const longTaskAlerts = this.alerts.filter(a => a.type === 'long-task');
    if (longTaskAlerts.length > 5) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Många långa uppgifter upptäckta. Optimera JavaScript-exekvering.',
        action: 'Använd web workers eller splittra upp tunga operationer'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Clear metrics and history
   * @param {string} type - Type to clear (optional)
   */
  clear(type = null) {
    if (type) {
      if (this.metrics[type]) {
        if (Array.isArray(this.metrics[type])) {
          this.metrics[type] = [];
        } else if (this.metrics[type] instanceof Map) {
          this.metrics[type].clear();
        }
      }
    } else {
      // Clear all metrics
      this.metrics.marks.clear();
      this.metrics.measures.clear();
      this.metrics.resources = [];
      this.metrics.memory = [];
      this.metrics.network = [];
      this.metrics.userActions = [];
      this.alerts = [];
    }
    
    this.debugLog('cleared', { type });
  }
  
  /**
   * Debug logging
   * @param {string} action - Action name
   * @param {object} data - Debug data
   * @private
   */
  debugLog(action, data) {
    if (AppConfig.ENVIRONMENT === 'development') {
      console.log(`[PerformanceMonitor:${action}]`, data);
    }
  }
  
  /**
   * Destroy performance monitor
   */
  destroy() {
    // Disconnect observers
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn('Failed to disconnect performance observer:', error);
      }
    });
    
    this.observers = [];
    this.clear();
    
    console.log('📊 Performance monitoring destroyed');
  }
}

export default PerformanceMonitor;