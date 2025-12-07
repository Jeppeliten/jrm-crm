// Responsive Layout Manager - Dynamic responsive behavior management
// Hantering av responsiv layout och breakpoint-förändringar

import { AppConfig } from '../config/AppConfig.js';

/**
 * ResponsiveManager Class - Manages responsive layout behavior
 * Features: breakpoint detection, responsive utilities, mobile/desktop adaptation
 */
export class ResponsiveManager {
  constructor(options = {}) {
    this.options = {
      // Breakpoints (must match CSS)
      breakpoints: {
        xs: 0,
        sm: 576,
        md: 768,
        lg: 992,
        xl: 1200,
        xxl: 1400
      },
      
      // Events
      onBreakpointChange: options.onBreakpointChange || null,
      onOrientationChange: options.onOrientationChange || null,
      
      // Debounce resize events
      resizeDebounce: options.resizeDebounce || 150,
      
      // Auto-adapt features
      autoAdaptTables: options.autoAdaptTables !== false,
      autoAdaptModals: options.autoAdaptModals !== false,
      autoAdaptNavigation: options.autoAdaptNavigation !== false,
      
      ...options
    };
    
    // State
    this.currentBreakpoint = this.getCurrentBreakpoint();
    this.isLandscape = window.innerWidth > window.innerHeight;
    this.isMobile = this.isMobileDevice();
    this.isTouch = this.isTouchDevice();
    
    // Callbacks
    this.resizeCallbacks = new Set();
    this.breakpointCallbacks = new Map();
    
    this.bindMethods();
  }
  
  /**
   * Initialize responsive manager
   */
  async initialize() {
    this.setupEventListeners();
    this.addBodyClasses();
    this.setupAutoAdaptation();
    
    // Initial adaptation
    this.adaptToCurrentBreakpoint();
    
    console.log('📱 ResponsiveManager initialized', {
      breakpoint: this.currentBreakpoint,
      mobile: this.isMobile,
      touch: this.isTouch,
      landscape: this.isLandscape
    });
  }
  
  /**
   * Bind methods to maintain context
   * @private
   */
  bindMethods() {
    this.handleResize = this.handleResize.bind(this);
    this.handleOrientationChange = this.handleOrientationChange.bind(this);
  }
  
  /**
   * Set up event listeners
   * @private
   */
  setupEventListeners() {
    // Debounced resize handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(this.handleResize, this.options.resizeDebounce);
    });
    
    // Orientation change
    window.addEventListener('orientationchange', this.handleOrientationChange);
    
    // Media query listeners for breakpoints
    Object.entries(this.options.breakpoints).forEach(([name, width]) => {
      if (width > 0) {
        const mediaQuery = window.matchMedia(`(min-width: ${width}px)`);
        mediaQuery.addListener(() => this.checkBreakpointChange());
      }
    });
  }
  
  /**
   * Add responsive classes to body
   * @private
   */
  addBodyClasses() {
    const body = document.body;
    
    // Device type classes
    body.classList.toggle('is-mobile', this.isMobile);
    body.classList.toggle('is-desktop', !this.isMobile);
    body.classList.toggle('is-touch', this.isTouch);
    body.classList.toggle('is-no-touch', !this.isTouch);
    
    // Orientation class
    body.classList.toggle('is-landscape', this.isLandscape);
    body.classList.toggle('is-portrait', !this.isLandscape);
    
    // Breakpoint class
    body.classList.add(`breakpoint-${this.currentBreakpoint}`);
  }
  
  /**
   * Set up automatic adaptations
   * @private
   */
  setupAutoAdaptation() {
    if (this.options.autoAdaptTables) {
      this.setupTableAdaptation();
    }
    
    if (this.options.autoAdaptModals) {
      this.setupModalAdaptation();
    }
    
    if (this.options.autoAdaptNavigation) {
      this.setupNavigationAdaptation();
    }
  }
  
  /**
   * Set up table responsive adaptation
   * @private
   */
  setupTableAdaptation() {
    // Observer for new tables
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tables = node.querySelectorAll?.('table') || 
                          (node.tagName === 'TABLE' ? [node] : []);
            tables.forEach(table => this.adaptTable(table));
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Adapt existing tables
    document.querySelectorAll('table').forEach(table => this.adaptTable(table));
  }
  
  /**
   * Set up modal responsive adaptation
   * @private
   */
  setupModalAdaptation() {
    // Observer for modal changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && 
            mutation.attributeName === 'class' &&
            mutation.target.classList.contains('modal')) {
          this.adaptModal(mutation.target);
        }
      });
    });
    
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class']
    });
  }
  
  /**
   * Set up navigation responsive adaptation
   * @private
   */
  setupNavigationAdaptation() {
    // Automatically manage mobile navigation
    this.onBreakpointChange((breakpoint) => {
      const navbars = document.querySelectorAll('.navbar');
      
      navbars.forEach(navbar => {
        const collapse = navbar.querySelector('.navbar-collapse');
        const toggler = navbar.querySelector('.navbar-toggler');
        
        if (this.isBreakpointUp('lg')) {
          // Desktop: always show navigation
          if (collapse) {
            collapse.classList.add('show');
            collapse.style.display = '';
          }
          if (toggler) {
            toggler.setAttribute('aria-expanded', 'true');
          }
        } else {
          // Mobile: hide by default
          if (collapse && !collapse.classList.contains('show')) {
            collapse.style.display = 'none';
          }
        }
      });
    });
  }
  
  /**
   * Handle window resize
   * @private
   */
  handleResize() {
    const oldBreakpoint = this.currentBreakpoint;
    const oldOrientation = this.isLandscape;
    
    // Update state
    this.currentBreakpoint = this.getCurrentBreakpoint();
    this.isLandscape = window.innerWidth > window.innerHeight;
    
    // Update body classes
    if (oldBreakpoint !== this.currentBreakpoint) {
      document.body.classList.remove(`breakpoint-${oldBreakpoint}`);
      document.body.classList.add(`breakpoint-${this.currentBreakpoint}`);
    }
    
    if (oldOrientation !== this.isLandscape) {
      document.body.classList.toggle('is-landscape', this.isLandscape);
      document.body.classList.toggle('is-portrait', !this.isLandscape);
    }
    
    // Trigger callbacks
    this.resizeCallbacks.forEach(callback => {
      try {
        callback({
          width: window.innerWidth,
          height: window.innerHeight,
          breakpoint: this.currentBreakpoint,
          isLandscape: this.isLandscape
        });
      } catch (error) {
        console.error('Resize callback error:', error);
      }
    });
    
    // Breakpoint change event
    if (oldBreakpoint !== this.currentBreakpoint) {
      this.triggerBreakpointChange(this.currentBreakpoint, oldBreakpoint);
    }
    
    // Orientation change event
    if (oldOrientation !== this.isLandscape && this.options.onOrientationChange) {
      this.options.onOrientationChange(this.isLandscape ? 'landscape' : 'portrait');
    }
  }
  
  /**
   * Handle orientation change
   * @private
   */
  handleOrientationChange() {
    // Small delay to ensure dimensions are updated
    setTimeout(() => {
      this.handleResize();
    }, 100);
  }
  
  /**
   * Check for breakpoint changes
   * @private
   */
  checkBreakpointChange() {
    const newBreakpoint = this.getCurrentBreakpoint();
    
    if (newBreakpoint !== this.currentBreakpoint) {
      const oldBreakpoint = this.currentBreakpoint;
      this.currentBreakpoint = newBreakpoint;
      
      // Update body class
      document.body.classList.remove(`breakpoint-${oldBreakpoint}`);
      document.body.classList.add(`breakpoint-${this.currentBreakpoint}`);
      
      this.triggerBreakpointChange(newBreakpoint, oldBreakpoint);
    }
  }
  
  /**
   * Trigger breakpoint change callbacks
   * @param {string} newBreakpoint - New breakpoint
   * @param {string} oldBreakpoint - Old breakpoint
   * @private
   */
  triggerBreakpointChange(newBreakpoint, oldBreakpoint) {
    // Global callback
    if (this.options.onBreakpointChange) {
      this.options.onBreakpointChange(newBreakpoint, oldBreakpoint);
    }
    
    // Specific breakpoint callbacks
    const callbacks = this.breakpointCallbacks.get(newBreakpoint) || [];
    callbacks.forEach(callback => {
      try {
        callback(newBreakpoint, oldBreakpoint);
      } catch (error) {
        console.error('Breakpoint callback error:', error);
      }
    });
    
    // Trigger adaptation
    this.adaptToCurrentBreakpoint();
  }
  
  /**
   * Adapt to current breakpoint
   * @private
   */
  adaptToCurrentBreakpoint() {
    // Adapt existing elements
    document.querySelectorAll('table').forEach(table => this.adaptTable(table));
    document.querySelectorAll('.modal.show').forEach(modal => this.adaptModal(modal));
  }
  
  /**
   * Get current breakpoint
   * @returns {string} Current breakpoint name
   */
  getCurrentBreakpoint() {
    const width = window.innerWidth;
    const breakpoints = Object.entries(this.options.breakpoints)
      .sort(([,a], [,b]) => b - a); // Sort descending
    
    for (const [name, minWidth] of breakpoints) {
      if (width >= minWidth) {
        return name;
      }
    }
    
    return 'xs';
  }
  
  /**
   * Check if current breakpoint is at or above specified breakpoint
   * @param {string} breakpoint - Breakpoint to check
   * @returns {boolean} Is at or above breakpoint
   */
  isBreakpointUp(breakpoint) {
    const currentWidth = this.options.breakpoints[this.currentBreakpoint];
    const targetWidth = this.options.breakpoints[breakpoint];
    
    return currentWidth >= targetWidth;
  }
  
  /**
   * Check if current breakpoint is below specified breakpoint
   * @param {string} breakpoint - Breakpoint to check
   * @returns {boolean} Is below breakpoint
   */
  isBreakpointDown(breakpoint) {
    return !this.isBreakpointUp(breakpoint);
  }
  
  /**
   * Check if mobile device
   * @returns {boolean} Is mobile device
   */
  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  /**
   * Check if touch device
   * @returns {boolean} Is touch device
   */
  isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }
  
  /**
   * Adapt table for current breakpoint
   * @param {HTMLElement} table - Table element
   */
  adaptTable(table) {
    if (!table || table.hasAttribute('data-responsive-adapted')) return;
    
    table.setAttribute('data-responsive-adapted', 'true');
    
    // Make table responsive on mobile
    if (this.isBreakpointDown('md')) {
      const wrapper = table.closest('.table-responsive') || this.wrapTable(table);
      wrapper.style.overflowX = 'auto';
      
      // Add mobile-friendly classes
      table.classList.add('table-mobile');
      
      // Hide less important columns on mobile (if marked)
      const hiddenCols = table.querySelectorAll('th[data-mobile="hide"], td[data-mobile="hide"]');
      hiddenCols.forEach(col => col.style.display = 'none');
      
    } else {
      // Show all columns on desktop
      const hiddenCols = table.querySelectorAll('th[data-mobile="hide"], td[data-mobile="hide"]');
      hiddenCols.forEach(col => col.style.display = '');
      
      table.classList.remove('table-mobile');
    }
  }
  
  /**
   * Wrap table in responsive container
   * @param {HTMLElement} table - Table element
   * @returns {HTMLElement} Wrapper element
   * @private
   */
  wrapTable(table) {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-responsive';
    
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
    
    return wrapper;
  }
  
  /**
   * Adapt modal for current breakpoint
   * @param {HTMLElement} modal - Modal element
   */
  adaptModal(modal) {
    if (!modal) return;
    
    const dialog = modal.querySelector('.modal-dialog');
    if (!dialog) return;
    
    if (this.isBreakpointDown('md')) {
      // Mobile: full screen modals
      dialog.classList.add('modal-fullscreen-sm-down');
      modal.classList.add('modal-mobile');
    } else {
      // Desktop: normal modals
      dialog.classList.remove('modal-fullscreen-sm-down');
      modal.classList.remove('modal-mobile');
    }
  }
  
  /**
   * Add resize callback
   * @param {Function} callback - Resize callback
   * @returns {Function} Cleanup function
   */
  onResize(callback) {
    this.resizeCallbacks.add(callback);
    
    return () => {
      this.resizeCallbacks.delete(callback);
    };
  }
  
  /**
   * Add breakpoint change callback
   * @param {string|Function} breakpointOrCallback - Breakpoint name or callback
   * @param {Function} callback - Callback function (if first param is breakpoint)
   * @returns {Function} Cleanup function
   */
  onBreakpointChange(breakpointOrCallback, callback = null) {
    if (typeof breakpointOrCallback === 'function') {
      // Global breakpoint change callback
      const globalCallback = breakpointOrCallback;
      this.options.onBreakpointChange = globalCallback;
      
      return () => {
        this.options.onBreakpointChange = null;
      };
    }
    
    // Specific breakpoint callback
    const breakpoint = breakpointOrCallback;
    
    if (!this.breakpointCallbacks.has(breakpoint)) {
      this.breakpointCallbacks.set(breakpoint, []);
    }
    
    this.breakpointCallbacks.get(breakpoint).push(callback);
    
    return () => {
      const callbacks = this.breakpointCallbacks.get(breakpoint) || [];
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }
  
  /**
   * Get viewport dimensions
   * @returns {object} Viewport info
   */
  getViewportInfo() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      breakpoint: this.currentBreakpoint,
      isLandscape: this.isLandscape,
      isMobile: this.isMobile,
      isTouch: this.isTouch
    };
  }
  
  /**
   * Apply responsive classes to element
   * @param {HTMLElement} element - Target element
   * @param {object} classes - Responsive classes config
   */
  applyResponsiveClasses(element, classes) {
    if (!element) return;
    
    // Remove all responsive classes first
    const allClasses = Object.values(classes).flat();
    element.classList.remove(...allClasses);
    
    // Apply current breakpoint classes
    const currentClasses = classes[this.currentBreakpoint] || [];
    element.classList.add(...currentClasses);
  }
  
  /**
   * Create responsive image with srcset
   * @param {object} options - Image options
   * @returns {HTMLElement} Image element
   */
  createResponsiveImage(options) {
    const img = document.createElement('img');
    
    img.src = options.src;
    img.alt = options.alt || '';
    
    if (options.srcset) {
      img.srcset = options.srcset;
    }
    
    if (options.sizes) {
      img.sizes = options.sizes;
    }
    
    // Default Swedish responsive sizes
    if (!options.sizes && options.srcset) {
      img.sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';
    }
    
    // Loading optimization
    img.loading = options.loading || 'lazy';
    img.decoding = 'async';
    
    return img;
  }
  
  /**
   * Enable/disable auto-adaptation features
   * @param {string} feature - Feature name
   * @param {boolean} enabled - Enable/disable
   */
  setAutoAdaptation(feature, enabled) {
    const key = `autoAdapt${feature.charAt(0).toUpperCase() + feature.slice(1)}`;
    
    if (this.options.hasOwnProperty(key)) {
      this.options[key] = enabled;
      
      if (enabled) {
        // Re-setup the specific adaptation
        switch (feature) {
          case 'tables':
            this.setupTableAdaptation();
            break;
          case 'modals':
            this.setupModalAdaptation();
            break;
          case 'navigation':
            this.setupNavigationAdaptation();
            break;
        }
      }
    }
  }
  
  /**
   * Force adaptation refresh
   */
  refresh() {
    this.handleResize();
  }
  
  /**
   * Destroy responsive manager
   */
  destroy() {
    // Remove event listeners
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleOrientationChange);
    
    // Clear callbacks
    this.resizeCallbacks.clear();
    this.breakpointCallbacks.clear();
    
    // Remove body classes
    const body = document.body;
    body.classList.remove(
      'is-mobile', 'is-desktop', 'is-touch', 'is-no-touch',
      'is-landscape', 'is-portrait', `breakpoint-${this.currentBreakpoint}`
    );
    
    console.log('📱 ResponsiveManager destroyed');
  }
}

export default ResponsiveManager;