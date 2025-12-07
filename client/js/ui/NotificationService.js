// Notification Service - Professional Toast System
// Hantering av meddelanden med köhantering, positionering och animationer

import { AppConfig } from '../config/AppConfig.js';

/**
 * NotificationService Class - Toast notification system
 * Handles user feedback with queuing, positioning, and accessibility
 */
export class NotificationService {
  constructor(options = {}) {
    this.options = {
      position: options.position || 'top-right', // top-left, top-right, bottom-left, bottom-right, top-center, bottom-center
      autoHide: options.autoHide !== false,
      duration: options.duration || AppConfig.NOTIFICATION_DURATION,
      maxNotifications: options.maxNotifications || 5,
      animationDuration: options.animationDuration || AppConfig.ANIMATION_DURATION,
      spacing: options.spacing || 16,
      ...options
    };
    
    this.notifications = [];
    this.container = null;
    this.eventBus = options.eventBus || null;
    this.idCounter = 0;
    
    this.bindMethods();
  }
  
  /**
   * Initialize notification service
   */
  async initialize() {
    this.createContainer();
    this.setupAccessibility();
    
    if (this.eventBus) {
      this.eventBus.emit('notifications:initialized');
    }
    
    console.log('🔔 Notification Service initialized');
  }
  
  /**
   * Bind methods to maintain context
   * @private
   */
  bindMethods() {
    this.handleNotificationClick = this.handleNotificationClick.bind(this);
    this.handleNotificationKeyDown = this.handleNotificationKeyDown.bind(this);
  }
  
  /**
   * Create notification container
   * @private
   */
  createContainer() {
    if (document.getElementById('notification-container')) return;
    
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.className = `notification-container notification-${this.options.position}`;
    this.container.setAttribute('aria-live', 'polite');
    this.container.setAttribute('aria-label', 'Meddelanden');
    
    // Position the container
    const styles = this.getContainerStyles();
    Object.assign(this.container.style, styles);
    
    document.body.appendChild(this.container);
  }
  
  /**
   * Get container positioning styles
   * @returns {object} CSS styles
   * @private
   */
  getContainerStyles() {
    const baseStyles = {
      position: 'fixed',
      zIndex: AppConfig.get('Z_TOAST', 1080),
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: `${this.options.spacing}px`
    };
    
    const positions = {
      'top-left': { top: '20px', left: '20px' },
      'top-right': { top: '20px', right: '20px' },
      'top-center': { top: '20px', left: '50%', transform: 'translateX(-50%)' },
      'bottom-left': { bottom: '20px', left: '20px', flexDirection: 'column-reverse' },
      'bottom-right': { bottom: '20px', right: '20px', flexDirection: 'column-reverse' },
      'bottom-center': { bottom: '20px', left: '50%', transform: 'translateX(-50%)', flexDirection: 'column-reverse' }
    };
    
    return { ...baseStyles, ...positions[this.options.position] };
  }
  
  /**
   * Set up accessibility features
   * @private
   */
  setupAccessibility() {
    // Screen reader announcements will be handled by aria-live
    // Focus management for keyboard users
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.clearAll();
      }
    });
  }
  
  /**
   * Show a notification
   * @param {string|object} message - Message text or notification config
   * @param {string} type - Notification type (success, error, warning, info)
   * @param {object} options - Additional options
   * @returns {object} Notification instance
   */
  show(message, type = 'info', options = {}) {
    const config = this.normalizeConfig(message, type, options);
    const notification = this.createNotification(config);
    
    // Add to collection
    this.notifications.push(notification);
    
    // Manage queue
    this.manageQueue();
    
    // Render notification
    this.renderNotification(notification);
    
    // Set up auto-hide
    if (config.autoHide) {
      this.scheduleAutoHide(notification);
    }
    
    // Emit event
    if (this.eventBus) {
      this.eventBus.emit('notification:shown', { id: notification.id, config });
    }
    
    return notification;
  }
  
  /**
   * Show success notification
   * @param {string} message - Message text
   * @param {object} options - Additional options
   * @returns {object} Notification instance
   */
  success(message, options = {}) {
    return this.show(message, 'success', options);
  }
  
  /**
   * Show error notification
   * @param {string} message - Message text
   * @param {object} options - Additional options
   * @returns {object} Notification instance
   */
  error(message, options = {}) {
    return this.show(message, 'error', { autoHide: false, ...options });
  }
  
  /**
   * Show warning notification
   * @param {string} message - Message text
   * @param {object} options - Additional options
   * @returns {object} Notification instance
   */
  warning(message, options = {}) {
    return this.show(message, 'warning', options);
  }
  
  /**
   * Show info notification
   * @param {string} message - Message text
   * @param {object} options - Additional options
   * @returns {object} Notification instance
   */
  info(message, options = {}) {
    return this.show(message, 'info', options);
  }
  
  /**
   * Hide a specific notification
   * @param {string} notificationId - Notification ID
   * @returns {Promise<void>}
   */
  async hide(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (!notification) return;
    
    // Cancel auto-hide timer
    if (notification.timer) {
      clearTimeout(notification.timer);
    }
    
    // Animate out
    await this.animateOut(notification);
    
    // Remove from DOM and collection
    this.removeNotification(notification);
    
    // Emit event
    if (this.eventBus) {
      this.eventBus.emit('notification:hidden', { id: notificationId });
    }
  }
  
  /**
   * Clear all notifications
   * @returns {Promise<void>}
   */
  async clearAll() {
    const hidePromises = this.notifications.map(n => this.hide(n.id));
    await Promise.all(hidePromises);
  }
  
  /**
   * Update notification content
   * @param {string} notificationId - Notification ID
   * @param {object} updates - Updates to apply
   */
  update(notificationId, updates) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (!notification) return;
    
    // Update config
    Object.assign(notification.config, updates);
    
    // Re-render
    this.updateNotificationElement(notification);
    
    // Reset auto-hide if duration changed
    if (updates.duration !== undefined || updates.autoHide !== undefined) {
      if (notification.timer) {
        clearTimeout(notification.timer);
      }
      
      if (notification.config.autoHide) {
        this.scheduleAutoHide(notification);
      }
    }
  }
  
  /**
   * Normalize notification configuration
   * @param {string|object} message - Message or config
   * @param {string} type - Notification type
   * @param {object} options - Additional options
   * @returns {object} Normalized config
   * @private
   */
  normalizeConfig(message, type, options) {
    if (typeof message === 'object') {
      return {
        type: 'info',
        autoHide: this.options.autoHide,
        duration: this.options.duration,
        dismissible: true,
        actions: [],
        ...message
      };
    }
    
    return {
      message,
      type,
      autoHide: this.options.autoHide,
      duration: this.options.duration,
      dismissible: true,
      actions: [],
      ...options
    };
  }
  
  /**
   * Create notification instance
   * @param {object} config - Notification config
   * @returns {object} Notification instance
   * @private
   */
  createNotification(config) {
    return {
      id: this.generateId(),
      config,
      element: null,
      timer: null,
      createdAt: new Date(),
      isVisible: false
    };
  }
  
  /**
   * Manage notification queue
   * @private
   */
  manageQueue() {
    // Remove oldest notifications if exceeding limit
    while (this.notifications.length > this.options.maxNotifications) {
      const oldest = this.notifications[0];
      this.hide(oldest.id);
    }
  }
  
  /**
   * Render notification in DOM
   * @param {object} notification - Notification instance
   * @private
   */
  async renderNotification(notification) {
    const element = this.createNotificationElement(notification);
    notification.element = element;
    
    // Add to container
    this.container.appendChild(element);
    
    // Animate in
    await this.animateIn(notification);
    
    notification.isVisible = true;
  }
  
  /**
   * Create notification DOM element
   * @param {object} notification - Notification instance
   * @returns {HTMLElement} Notification element
   * @private
   */
  createNotificationElement(notification) {
    const { config } = notification;
    const element = document.createElement('div');
    
    element.className = `notification notification-${config.type}`;
    element.dataset.notificationId = notification.id;
    element.setAttribute('role', 'alert');
    element.setAttribute('aria-live', 'assertive');
    element.style.cssText = `
      background: white;
      border: 1px solid;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      max-width: 400px;
      pointer-events: auto;
      transform: translateX(${this.getTransformOffset()});
      opacity: 0;
      transition: all ${this.options.animationDuration}ms ease;
      position: relative;
    `;
    
    // Apply type-specific styling
    this.applyTypeStyles(element, config.type);
    
    // Generate content
    element.innerHTML = this.generateNotificationContent(notification);
    
    // Set up event listeners
    this.setupNotificationEvents(notification, element);
    
    return element;
  }
  
  /**
   * Apply type-specific styles
   * @param {HTMLElement} element - Notification element
   * @param {string} type - Notification type
   * @private
   */
  applyTypeStyles(element, type) {
    const styles = {
      success: {
        borderColor: '#10b981',
        backgroundColor: '#f0fdf4'
      },
      error: {
        borderColor: '#ef4444',
        backgroundColor: '#fef2f2'
      },
      warning: {
        borderColor: '#f59e0b',
        backgroundColor: '#fffbeb'
      },
      info: {
        borderColor: '#3b82f6',
        backgroundColor: '#eff6ff'
      }
    };
    
    const typeStyles = styles[type] || styles.info;
    Object.assign(element.style, typeStyles);
  }
  
  /**
   * Generate notification content HTML
   * @param {object} notification - Notification instance
   * @returns {string} HTML content
   * @private
   */
  generateNotificationContent(notification) {
    const { config } = notification;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    const icon = icons[config.type] || icons.info;
    
    const actions = config.actions.map(action => `
      <button type="button" class="notification-action btn btn-sm btn-${action.variant || 'secondary'}" 
              data-action="${action.id || action.text}">
        ${action.text}
      </button>
    `).join('');
    
    const dismissButton = config.dismissible ? `
      <button type="button" class="notification-dismiss" data-action="dismiss"
              style="position: absolute; top: 8px; right: 8px; background: none; border: none; 
                     color: inherit; opacity: 0.7; cursor: pointer; font-size: 16px; width: 24px; height: 24px;
                     display: flex; align-items: center; justify-content: center; border-radius: 4px;">
        ×
      </button>
    ` : '';
    
    return `
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="font-size: 18px; line-height: 1; margin-top: 2px;">${icon}</div>
        <div style="flex: 1; min-width: 0;">
          ${config.title ? `<div style="font-weight: 600; margin-bottom: 4px; color: #1f2937;">${config.title}</div>` : ''}
          <div style="color: #4b5563; font-size: 14px; line-height: 1.5;">${config.message}</div>
          ${actions ? `<div style="margin-top: 8px; display: flex; gap: 8px;">${actions}</div>` : ''}
        </div>
      </div>
      ${dismissButton}
    `;
  }
  
  /**
   * Set up notification event listeners
   * @param {object} notification - Notification instance
   * @param {HTMLElement} element - Notification element
   * @private
   */
  setupNotificationEvents(notification, element) {
    element.addEventListener('click', this.handleNotificationClick);
    element.addEventListener('keydown', this.handleNotificationKeyDown);
    
    // Make dismissible notifications focusable
    if (notification.config.dismissible) {
      element.setAttribute('tabindex', '0');
    }
  }
  
  /**
   * Handle notification click
   * @param {MouseEvent} e - Click event
   * @private
   */
  handleNotificationClick(e) {
    const notificationElement = e.currentTarget;
    const notificationId = notificationElement.dataset.notificationId;
    const notification = this.notifications.find(n => n.id === notificationId);
    
    if (!notification) return;
    
    const actionElement = e.target.closest('[data-action]');
    if (actionElement) {
      const actionId = actionElement.dataset.action;
      
      if (actionId === 'dismiss') {
        this.hide(notificationId);
        return;
      }
      
      const action = notification.config.actions.find(a => 
        (a.id || a.text) === actionId
      );
      
      if (action && action.handler) {
        action.handler(notification);
        
        if (action.autoHide !== false) {
          this.hide(notificationId);
        }
      }
    }
  }
  
  /**
   * Handle notification keyboard events
   * @param {KeyboardEvent} e - Keyboard event
   * @private
   */
  handleNotificationKeyDown(e) {
    const notificationElement = e.currentTarget;
    const notificationId = notificationElement.dataset.notificationId;
    
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.hide(notificationId);
    }
  }
  
  /**
   * Schedule auto-hide for notification
   * @param {object} notification - Notification instance
   * @private
   */
  scheduleAutoHide(notification) {
    if (notification.timer) {
      clearTimeout(notification.timer);
    }
    
    notification.timer = setTimeout(() => {
      this.hide(notification.id);
    }, notification.config.duration);
  }
  
  /**
   * Get transform offset for animations
   * @returns {string} Transform offset
   * @private
   */
  getTransformOffset() {
    const position = this.options.position;
    
    if (position.includes('right')) {
      return '100%';
    } else if (position.includes('left')) {
      return '-100%';
    } else {
      return '0';
    }
  }
  
  /**
   * Animate notification in
   * @param {object} notification - Notification instance
   * @private
   */
  async animateIn(notification) {
    return new Promise((resolve) => {
      const element = notification.element;
      
      // Force reflow
      element.offsetHeight;
      
      // Animate
      element.style.transform = 'translateX(0)';
      element.style.opacity = '1';
      
      setTimeout(resolve, this.options.animationDuration);
    });
  }
  
  /**
   * Animate notification out
   * @param {object} notification - Notification instance
   * @private
   */
  async animateOut(notification) {
    return new Promise((resolve) => {
      const element = notification.element;
      
      element.style.transform = `translateX(${this.getTransformOffset()})`;
      element.style.opacity = '0';
      element.style.maxHeight = '0';
      element.style.marginBottom = '0';
      element.style.paddingTop = '0';
      element.style.paddingBottom = '0';
      
      setTimeout(resolve, this.options.animationDuration);
    });
  }
  
  /**
   * Remove notification from DOM and collection
   * @param {object} notification - Notification instance
   * @private
   */
  removeNotification(notification) {
    // Remove from DOM
    if (notification.element && notification.element.parentNode) {
      notification.element.remove();
    }
    
    // Remove from collection
    this.notifications = this.notifications.filter(n => n.id !== notification.id);
    
    // Clear timer
    if (notification.timer) {
      clearTimeout(notification.timer);
    }
  }
  
  /**
   * Update notification element content
   * @param {object} notification - Notification instance
   * @private
   */
  updateNotificationElement(notification) {
    if (!notification.element) return;
    
    const content = this.generateNotificationContent(notification);
    notification.element.innerHTML = content;
    
    // Re-apply type styles
    this.applyTypeStyles(notification.element, notification.config.type);
    
    // Re-setup events
    this.setupNotificationEvents(notification, notification.element);
  }
  
  /**
   * Generate unique ID
   * @returns {string} Unique ID
   * @private
   */
  generateId() {
    return `notification_${++this.idCounter}_${Date.now()}`;
  }
  
  /**
   * Get notification statistics
   * @returns {object} Statistics
   */
  getStats() {
    const byType = this.notifications.reduce((acc, n) => {
      acc[n.config.type] = (acc[n.config.type] || 0) + 1;
      return acc;
    }, {});
    
    return {
      total: this.notifications.length,
      byType,
      oldest: this.notifications[0]?.createdAt || null,
      newest: this.notifications[this.notifications.length - 1]?.createdAt || null
    };
  }
  
  /**
   * Get all active notifications
   * @returns {Array} Active notifications
   */
  getActiveNotifications() {
    return this.notifications.map(n => ({
      id: n.id,
      type: n.config.type,
      message: n.config.message,
      createdAt: n.createdAt,
      isVisible: n.isVisible
    }));
  }
  
  /**
   * Destroy notification service
   */
  destroy() {
    // Clear all notifications
    this.clearAll();
    
    // Remove container
    if (this.container && this.container.parentNode) {
      this.container.remove();
    }
    
    // Reset state
    this.notifications = [];
    this.container = null;
    this.idCounter = 0;
    
    console.log('🔔 Notification Service destroyed');
  }
}

export default NotificationService;