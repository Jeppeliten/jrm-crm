// Modal Manager - Professional Modal System
// Hantering av modaler med stack-navigation, A11y och animationer

import { AppConfig } from '../config/AppConfig.js';

/**
 * ModalManager Class - Centralized modal management
 * Handles modal lifecycle, focus management, and accessibility
 */
export class ModalManager {
  constructor(options = {}) {
    this.options = {
      animationDuration: options.animationDuration || AppConfig.ANIMATION_DURATION,
      stackNavigation: options.stackNavigation !== false,
      closeOnEscape: options.closeOnEscape !== false,
      closeOnBackdrop: options.closeOnBackdrop !== false,
      trapFocus: options.trapFocus !== false,
      ...options
    };
    
    this.modalStack = [];
    this.eventBus = options.eventBus || null;
    this.activeModal = null;
    this.previousFocus = null;
    
    this.bindMethods();
  }
  
  /**
   * Initialize modal manager
   */
  async initialize() {
    this.setupEventListeners();
    this.createModalContainer();
    
    if (this.eventBus) {
      this.eventBus.emit('modal:initialized');
    }
    
    console.log('🖼️ Modal Manager initialized');
  }
  
  /**
   * Bind methods to maintain context
   * @private
   */
  bindMethods() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleBackdropClick = this.handleBackdropClick.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }
  
  /**
   * Set up global event listeners
   * @private
   */
  setupEventListeners() {
    document.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('resize', this.handleResize);
    
    // Handle page navigation
    window.addEventListener('beforeunload', () => {
      this.closeAll();
    });
  }
  
  /**
   * Create modal container in DOM
   * @private
   */
  createModalContainer() {
    if (document.getElementById('modal-container')) return;
    
    const container = document.createElement('div');
    container.id = 'modal-container';
    container.className = 'modal-container';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: ${AppConfig.get('Z_MODAL', 1050)};
    `;
    
    document.body.appendChild(container);
  }
  
  /**
   * Open a modal
   * @param {object} config - Modal configuration
   * @returns {Promise<object>} Modal instance
   */
  async open(config) {
    const modalConfig = this.validateConfig(config);
    const modal = this.createModal(modalConfig);
    
    // Store previous focus
    this.previousFocus = document.activeElement;
    
    // Add to stack
    this.modalStack.push(modal);
    this.activeModal = modal;
    
    // Render modal
    await this.renderModal(modal);
    
    // Handle body scroll
    this.updateBodyScroll();
    
    // Set up focus management
    if (this.options.trapFocus) {
      this.setupFocusTrap(modal);
    }
    
    // Emit events
    if (this.eventBus) {
      this.eventBus.emit('modal:opened', { id: modal.id, config: modalConfig });
    }
    
    return modal;
  }
  
  /**
   * Close a modal
   * @param {string} modalId - Modal ID to close
   * @param {*} result - Result to return
   * @returns {Promise<void>}
   */
  async close(modalId, result = null) {
    const modal = this.findModal(modalId);
    if (!modal) return;
    
    // Remove from stack
    this.modalStack = this.modalStack.filter(m => m.id !== modalId);
    
    // Update active modal
    this.activeModal = this.modalStack[this.modalStack.length - 1] || null;
    
    // Animate out and remove
    await this.animateOut(modal);
    this.removeModal(modal);
    
    // Restore focus
    if (this.modalStack.length === 0 && this.previousFocus) {
      this.previousFocus.focus();
      this.previousFocus = null;
    }
    
    // Update body scroll
    this.updateBodyScroll();
    
    // Resolve promise if exists
    if (modal.promise && modal.resolve) {
      modal.resolve(result);
    }
    
    // Emit events
    if (this.eventBus) {
      this.eventBus.emit('modal:closed', { id: modalId, result });
    }
  }
  
  /**
   * Close all modals
   * @returns {Promise<void>}
   */
  async closeAll() {
    const modalIds = this.modalStack.map(m => m.id);
    
    for (const modalId of modalIds) {
      await this.close(modalId);
    }
  }
  
  /**
   * Show confirmation dialog
   * @param {object} config - Dialog configuration
   * @returns {Promise<boolean>} User confirmation
   */
  async confirm(config) {
    const {
      title = 'Bekräfta',
      message = 'Är du säker?',
      confirmText = 'Ja',
      cancelText = 'Avbryt',
      type = 'warning'
    } = config;
    
    return new Promise((resolve) => {
      this.open({
        title,
        template: 'confirm-dialog',
        data: { message, confirmText, cancelText, type },
        size: 'sm',
        closable: false,
        actions: [
          {
            text: cancelText,
            variant: 'secondary',
            handler: () => resolve(false)
          },
          {
            text: confirmText,
            variant: type === 'danger' ? 'danger' : 'primary',
            handler: () => resolve(true)
          }
        ]
      });
    });
  }
  
  /**
   * Show alert dialog
   * @param {object} config - Alert configuration
   * @returns {Promise<void>}
   */
  async alert(config) {
    const {
      title = 'Information',
      message = '',
      type = 'info',
      okText = 'OK'
    } = config;
    
    return new Promise((resolve) => {
      this.open({
        title,
        template: 'alert-dialog',
        data: { message, type },
        size: 'sm',
        closable: false,
        actions: [
          {
            text: okText,
            variant: 'primary',
            handler: () => resolve()
          }
        ]
      });
    });
  }
  
  /**
   * Show prompt dialog
   * @param {object} config - Prompt configuration
   * @returns {Promise<string|null>} User input or null if cancelled
   */
  async prompt(config) {
    const {
      title = 'Ange värde',
      message = '',
      placeholder = '',
      defaultValue = '',
      okText = 'OK',
      cancelText = 'Avbryt'
    } = config;
    
    return new Promise((resolve) => {
      let inputValue = defaultValue;
      
      this.open({
        title,
        template: 'prompt-dialog',
        data: { message, placeholder, defaultValue },
        size: 'sm',
        closable: false,
        onRender: (modal) => {
          const input = modal.element.querySelector('.prompt-input');
          if (input) {
            input.focus();
            input.addEventListener('input', (e) => {
              inputValue = e.target.value;
            });
            input.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                resolve(inputValue);
                this.close(modal.id);
              }
            });
          }
        },
        actions: [
          {
            text: cancelText,
            variant: 'secondary',
            handler: () => resolve(null)
          },
          {
            text: okText,
            variant: 'primary',
            handler: () => resolve(inputValue)
          }
        ]
      });
    });
  }
  
  /**
   * Validate modal configuration
   * @param {object} config - Modal configuration
   * @returns {object} Validated configuration
   * @private
   */
  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Modal configuration is required');
    }
    
    return {
      id: config.id || this.generateId(),
      title: config.title || '',
      content: config.content || '',
      template: config.template || null,
      data: config.data || {},
      size: config.size || 'md', // sm, md, lg, xl
      closable: config.closable !== false,
      backdrop: config.backdrop !== false,
      keyboard: config.keyboard !== false,
      actions: config.actions || [],
      onRender: config.onRender || null,
      onClose: config.onClose || null,
      className: config.className || '',
      ...config
    };
  }
  
  /**
   * Create modal instance
   * @param {object} config - Modal configuration
   * @returns {object} Modal instance
   * @private
   */
  createModal(config) {
    return {
      id: config.id,
      config,
      element: null,
      promise: null,
      resolve: null,
      reject: null,
      createdAt: new Date(),
      isVisible: false
    };
  }
  
  /**
   * Render modal in DOM
   * @param {object} modal - Modal instance
   * @private
   */
  async renderModal(modal) {
    const { config } = modal;
    
    // Create backdrop
    const backdrop = this.createBackdrop(modal);
    
    // Create modal element
    const modalElement = this.createModalElement(modal);
    modal.element = modalElement;
    
    // Add to container
    const container = document.getElementById('modal-container');
    container.appendChild(backdrop);
    container.appendChild(modalElement);
    
    // Animate in
    await this.animateIn(modal);
    
    // Call onRender callback
    if (config.onRender && typeof config.onRender === 'function') {
      config.onRender(modal);
    }
    
    modal.isVisible = true;
  }
  
  /**
   * Create backdrop element
   * @param {object} modal - Modal instance
   * @returns {HTMLElement} Backdrop element
   * @private
   */
  createBackdrop(modal) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset.modalId = modal.id;
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      opacity: 0;
      transition: opacity ${this.options.animationDuration}ms ease;
      pointer-events: auto;
      z-index: 1;
    `;
    
    if (this.options.closeOnBackdrop) {
      backdrop.addEventListener('click', this.handleBackdropClick);
    }
    
    return backdrop;
  }
  
  /**
   * Create modal element
   * @param {object} modal - Modal instance
   * @returns {HTMLElement} Modal element
   * @private
   */
  createModalElement(modal) {
    const { config } = modal;
    
    const modalElement = document.createElement('div');
    modalElement.className = `modal modal-${config.size} ${config.className}`;
    modalElement.dataset.modalId = modal.id;
    modalElement.setAttribute('role', 'dialog');
    modalElement.setAttribute('aria-modal', 'true');
    modalElement.setAttribute('aria-labelledby', `modal-title-${modal.id}`);
    
    modalElement.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.95);
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      opacity: 0;
      transition: all ${this.options.animationDuration}ms ease;
      pointer-events: auto;
      z-index: 2;
      max-height: 90vh;
      overflow: hidden;
      max-width: ${this.getSizePixels(config.size)};
      width: calc(100% - 2rem);
    `;
    
    // Generate content
    const content = this.generateModalContent(modal);
    modalElement.innerHTML = content;
    
    // Set up action handlers
    this.setupActionHandlers(modal, modalElement);
    
    return modalElement;
  }
  
  /**
   * Generate modal content HTML
   * @param {object} modal - Modal instance
   * @returns {string} HTML content
   * @private
   */
  generateModalContent(modal) {
    const { config } = modal;
    
    if (config.template) {
      return this.renderTemplate(config.template, config.data, modal);
    }
    
    const closeButton = config.closable ? `
      <button type="button" class="modal-close btn-icon btn-ghost" data-action="close">
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zM8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2z"/>
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>
    ` : '';
    
    const actions = config.actions.map(action => `
      <button type="button" class="btn btn-${action.variant || 'secondary'}" data-action="${action.text}">
        ${action.text}
      </button>
    `).join('');
    
    return `
      <div class="modal-header">
        <h3 class="modal-title" id="modal-title-${modal.id}">${config.title}</h3>
        ${closeButton}
      </div>
      <div class="modal-body">
        ${config.content}
      </div>
      ${actions ? `<div class="modal-footer">${actions}</div>` : ''}
    `;
  }
  
  /**
   * Render template with data
   * @param {string} templateName - Template name
   * @param {object} data - Template data
   * @param {object} modal - Modal instance
   * @returns {string} Rendered HTML
   * @private
   */
  renderTemplate(templateName, data, modal) {
    const templates = {
      'confirm-dialog': (data) => `
        <div class="modal-header">
          <h3 class="modal-title" id="modal-title-${modal.id}">Bekräfta</h3>
        </div>
        <div class="modal-body">
          <div class="flex items-center gap-4">
            <div class="text-${data.type === 'danger' ? 'red' : 'orange'} text-2xl">
              ${data.type === 'danger' ? '⚠️' : '❓'}
            </div>
            <div>${data.message}</div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-action="${data.cancelText}">
            ${data.cancelText}
          </button>
          <button type="button" class="btn btn-${data.type === 'danger' ? 'danger' : 'primary'}" data-action="${data.confirmText}">
            ${data.confirmText}
          </button>
        </div>
      `,
      
      'alert-dialog': (data) => `
        <div class="modal-header">
          <h3 class="modal-title" id="modal-title-${modal.id}">Information</h3>
        </div>
        <div class="modal-body">
          <div class="flex items-center gap-4">
            <div class="text-blue text-2xl">ℹ️</div>
            <div>${data.message}</div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-primary" data-action="OK">OK</button>
        </div>
      `,
      
      'prompt-dialog': (data) => `
        <div class="modal-header">
          <h3 class="modal-title" id="modal-title-${modal.id}">Ange värde</h3>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">${data.message}</label>
            <input type="text" class="form-input prompt-input" 
                   placeholder="${data.placeholder}" 
                   value="${data.defaultValue}">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-action="Avbryt">Avbryt</button>
          <button type="button" class="btn btn-primary" data-action="OK">OK</button>
        </div>
      `
    };
    
    const template = templates[templateName];
    return template ? template(data) : `<div>Template "${templateName}" not found</div>`;
  }
  
  /**
   * Set up action handlers for modal
   * @param {object} modal - Modal instance
   * @param {HTMLElement} element - Modal element
   * @private
   */
  setupActionHandlers(modal, element) {
    const { config } = modal;
    
    element.addEventListener('click', (e) => {
      const actionButton = e.target.closest('[data-action]');
      if (!actionButton) return;
      
      const actionText = actionButton.dataset.action;
      
      if (actionText === 'close') {
        this.close(modal.id);
        return;
      }
      
      // Find matching action
      const action = config.actions.find(a => a.text === actionText);
      if (action && action.handler) {
        action.handler();
        this.close(modal.id);
      }
    });
  }
  
  /**
   * Get size in pixels
   * @param {string} size - Size name
   * @returns {string} Size in pixels
   * @private
   */
  getSizePixels(size) {
    const sizes = {
      sm: '400px',
      md: '500px',
      lg: '800px',
      xl: '1200px'
    };
    return sizes[size] || sizes.md;
  }
  
  /**
   * Animate modal in
   * @param {object} modal - Modal instance
   * @private
   */
  async animateIn(modal) {
    return new Promise((resolve) => {
      const backdrop = document.querySelector(`[data-modal-id="${modal.id}"].modal-backdrop`);
      const element = modal.element;
      
      // Force reflow
      backdrop.offsetHeight;
      element.offsetHeight;
      
      // Animate
      backdrop.style.opacity = '1';
      element.style.opacity = '1';
      element.style.transform = 'translate(-50%, -50%) scale(1)';
      
      setTimeout(resolve, this.options.animationDuration);
    });
  }
  
  /**
   * Animate modal out
   * @param {object} modal - Modal instance
   * @private
   */
  async animateOut(modal) {
    return new Promise((resolve) => {
      const backdrop = document.querySelector(`[data-modal-id="${modal.id}"].modal-backdrop`);
      const element = modal.element;
      
      if (backdrop) {
        backdrop.style.opacity = '0';
      }
      
      if (element) {
        element.style.opacity = '0';
        element.style.transform = 'translate(-50%, -50%) scale(0.95)';
      }
      
      setTimeout(resolve, this.options.animationDuration);
    });
  }
  
  /**
   * Remove modal from DOM
   * @param {object} modal - Modal instance
   * @private
   */
  removeModal(modal) {
    const backdrop = document.querySelector(`[data-modal-id="${modal.id}"].modal-backdrop`);
    const element = modal.element;
    
    if (backdrop) {
      backdrop.remove();
    }
    
    if (element) {
      element.remove();
    }
  }
  
  /**
   * Set up focus trap for modal
   * @param {object} modal - Modal instance
   * @private
   */
  setupFocusTrap(modal) {
    const element = modal.element;
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    if (firstFocusable) {
      firstFocusable.focus();
    }
    
    element.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    });
  }
  
  /**
   * Update body scroll behavior
   * @private
   */
  updateBodyScroll() {
    if (this.modalStack.length > 0) {
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = this.getScrollbarWidth() + 'px';
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
  }
  
  /**
   * Get scrollbar width
   * @returns {number} Scrollbar width in pixels
   * @private
   */
  getScrollbarWidth() {
    const outer = document.createElement('div');
    outer.style.visibility = 'hidden';
    outer.style.overflow = 'scroll';
    document.body.appendChild(outer);
    
    const inner = document.createElement('div');
    outer.appendChild(inner);
    
    const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
    outer.remove();
    
    return scrollbarWidth;
  }
  
  /**
   * Handle keyboard events
   * @param {KeyboardEvent} e - Keyboard event
   * @private
   */
  handleKeyDown(e) {
    if (!this.activeModal) return;
    
    if (e.key === 'Escape' && this.options.closeOnEscape) {
      const { config } = this.activeModal;
      if (config.keyboard !== false) {
        this.close(this.activeModal.id);
      }
    }
  }
  
  /**
   * Handle backdrop click
   * @param {MouseEvent} e - Mouse event
   * @private
   */
  handleBackdropClick(e) {
    if (e.target.classList.contains('modal-backdrop')) {
      const modalId = e.target.dataset.modalId;
      const modal = this.findModal(modalId);
      
      if (modal && modal.config.backdrop !== false) {
        this.close(modalId);
      }
    }
  }
  
  /**
   * Handle window resize
   * @private
   */
  handleResize() {
    // Reposition modals if needed
    this.modalStack.forEach(modal => {
      if (modal.element) {
        // Modal positioning is handled by CSS, but we could add custom logic here
      }
    });
  }
  
  /**
   * Find modal by ID
   * @param {string} modalId - Modal ID
   * @returns {object|null} Modal instance
   * @private
   */
  findModal(modalId) {
    return this.modalStack.find(m => m.id === modalId) || null;
  }
  
  /**
   * Generate unique ID
   * @returns {string} Unique ID
   * @private
   */
  generateId() {
    return `modal_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }
  
  /**
   * Get modal stack info
   * @returns {object} Stack information
   */
  getStackInfo() {
    return {
      count: this.modalStack.length,
      activeId: this.activeModal?.id || null,
      stack: this.modalStack.map(m => ({
        id: m.id,
        title: m.config.title,
        createdAt: m.createdAt,
        isVisible: m.isVisible
      }))
    };
  }
  
  /**
   * Destroy modal manager
   */
  destroy() {
    // Close all modals
    this.closeAll();
    
    // Remove event listeners
    document.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('resize', this.handleResize);
    
    // Remove container
    const container = document.getElementById('modal-container');
    if (container) {
      container.remove();
    }
    
    // Reset state
    this.modalStack = [];
    this.activeModal = null;
    this.previousFocus = null;
    
    // Restore body scroll
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    
    console.log('🖼️ Modal Manager destroyed');
  }
}

export default ModalManager;