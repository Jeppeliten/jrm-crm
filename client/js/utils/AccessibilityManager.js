// Accessibility Manager - WCAG 2.1 AA compliance and Swedish accessibility standards
// Hantering av tillgänglighet enligt svenska riktlinjer och WCAG 2.1 AA

import { AppConfig } from '../config/AppConfig.js';

/**
 * AccessibilityManager Class - Comprehensive accessibility management
 * Features: WCAG 2.1 AA compliance, screen reader support, keyboard navigation, Swedish standards
 */
export class AccessibilityManager {
  constructor(options = {}) {
    this.options = {
      // Compliance levels
      level: options.level || 'AA', // A, AA, AAA
      
      // Features
      announcements: options.announcements !== false,
      keyboardNavigation: options.keyboardNavigation !== false,
      focusManagement: options.focusManagement !== false,
      colorContrast: options.colorContrast !== false,
      
      // Swedish specific
      language: options.language || 'sv-SE',
      screenReaderLang: options.screenReaderLang || 'sv',
      
      // Skip links
      skipLinks: options.skipLinks !== false,
      skipLinksTarget: options.skipLinksTarget || '#main-content',
      
      // Focus indicators
      focusIndicator: options.focusIndicator !== false,
      focusIndicatorColor: options.focusIndicatorColor || '#005aa0',
      
      // High contrast mode
      highContrast: options.highContrast || false,
      
      // Events
      onFocusChange: options.onFocusChange || null,
      onKeyboardNavigation: options.onKeyboardNavigation || null,
      onAnnouncement: options.onAnnouncement || null,
      
      ...options
    };
    
    // State
    this.isUsingKeyboard = false;
    this.lastFocusedElement = null;
    this.announceQueue = [];
    this.isAnnouncing = false;
    
    // Elements
    this.liveRegion = null;
    this.skipLinksContainer = null;
    this.focusIndicator = null;
    
    // Keyboard navigation state
    this.tabbableElements = [];
    this.currentTabIndex = -1;
    
    this.bindMethods();
  }
  
  /**
   * Initialize accessibility manager
   */
  async initialize() {
    this.createLiveRegion();
    this.createSkipLinks();
    this.setupFocusManagement();
    this.setupKeyboardNavigation();
    this.setupScreenReaderSupport();
    this.setupColorContrastSupport();
    this.setupEventListeners();
    
    // Initial accessibility check
    this.checkAccessibility();
    
    console.log('♿ AccessibilityManager initialized with WCAG', this.options.level, 'compliance');
  }
  
  /**
   * Bind methods to maintain context
   * @private
   */
  bindMethods() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.checkTabOrder = this.checkTabOrder.bind(this);
  }
  
  /**
   * Create ARIA live region for announcements
   * @private
   */
  createLiveRegion() {
    if (!this.options.announcements) return;
    
    this.liveRegion = document.createElement('div');
    this.liveRegion.id = 'accessibility-live-region';
    this.liveRegion.className = 'sr-only';
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.setAttribute('lang', this.options.screenReaderLang);
    
    document.body.appendChild(this.liveRegion);
  }
  
  /**
   * Create skip links for keyboard navigation
   * @private
   */
  createSkipLinks() {
    if (!this.options.skipLinks) return;
    
    this.skipLinksContainer = document.createElement('div');
    this.skipLinksContainer.className = 'skip-links';
    this.skipLinksContainer.innerHTML = `
      <a href="${this.options.skipLinksTarget}" class="skip-link">
        Hoppa till huvudinnehåll
      </a>
      <a href="#navigation" class="skip-link">
        Hoppa till navigation
      </a>
      <a href="#search" class="skip-link">
        Hoppa till sök
      </a>
    `;
    
    // Insert as first element in body
    document.body.insertBefore(this.skipLinksContainer, document.body.firstChild);
    
    this.addSkipLinkStyles();
  }
  
  /**
   * Add skip link styles
   * @private
   */
  addSkipLinkStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .skip-links {
        position: absolute;
        top: -999px;
        left: 0;
        z-index: 9999;
        width: 100%;
      }
      
      .skip-link {
        position: absolute;
        top: -999px;
        left: 6px;
        z-index: 10000;
        
        display: block;
        padding: 12px 16px;
        
        background: ${this.options.focusIndicatorColor};
        color: white;
        text-decoration: none;
        font-weight: 600;
        font-size: 14px;
        
        border-radius: 0 0 4px 4px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        
        transition: top 0.2s ease;
      }
      
      .skip-link:focus {
        top: 0;
        outline: 2px solid white;
        outline-offset: 2px;
      }
      
      .skip-link:hover,
      .skip-link:active {
        background: #003d73;
        color: white;
        text-decoration: none;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  /**
   * Set up focus management
   * @private
   */
  setupFocusManagement() {
    if (!this.options.focusManagement) return;
    
    // Create custom focus indicator
    if (this.options.focusIndicator) {
      this.createFocusIndicator();
    }
    
    // Track focus changes
    document.addEventListener('focusin', this.handleFocus);
    document.addEventListener('focusout', this.handleFocus);
  }
  
  /**
   * Create custom focus indicator
   * @private
   */
  createFocusIndicator() {
    const style = document.createElement('style');
    style.textContent = `
      /* Enhanced focus indicators for Swedish accessibility */
      *:focus {
        outline: 2px solid ${this.options.focusIndicatorColor} !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px rgba(0, 90, 160, 0.2) !important;
      }
      
      /* Special focus for interactive elements */
      button:focus,
      [role="button"]:focus,
      a:focus,
      input:focus,
      select:focus,
      textarea:focus {
        outline: 3px solid ${this.options.focusIndicatorColor} !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 5px rgba(0, 90, 160, 0.25) !important;
      }
      
      /* High contrast focus for critical elements */
      .btn-primary:focus,
      .btn-danger:focus,
      [data-critical="true"]:focus {
        outline: 4px solid #ffff00 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 6px rgba(255, 255, 0, 0.3) !important;
      }
      
      /* Remove browser default focus styles that conflict */
      *:focus:not(.focus-visible) {
        outline: none;
      }
      
      /* Keyboard-only focus styles */
      .keyboard-navigation *:focus-visible {
        outline: 3px solid ${this.options.focusIndicatorColor} !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 5px rgba(0, 90, 160, 0.25) !important;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  /**
   * Set up keyboard navigation
   * @private
   */
  setupKeyboardNavigation() {
    if (!this.options.keyboardNavigation) return;
    
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('click', this.handleClick);
    
    // Initial tab order check
    setTimeout(() => this.checkTabOrder(), 100);
  }
  
  /**
   * Set up screen reader support
   * @private
   */
  setupScreenReaderSupport() {
    // Set document language
    document.documentElement.lang = this.options.language;
    
    // Add screen reader specific enhancements
    this.enhanceScreenReaderSupport();
    
    // Observe DOM changes for new elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.enhanceElementAccessibility(node);
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  /**
   * Enhance screen reader support
   * @private
   */
  enhanceScreenReaderSupport() {
    // Add missing ARIA labels
    this.addMissingAriaLabels();
    
    // Enhance form accessibility
    this.enhanceFormAccessibility();
    
    // Enhance table accessibility
    this.enhanceTableAccessibility();
    
    // Enhance navigation accessibility
    this.enhanceNavigationAccessibility();
  }
  
  /**
   * Add missing ARIA labels
   * @private
   */
  addMissingAriaLabels() {
    // Buttons without labels
    const unlabeledButtons = document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])');
    unlabeledButtons.forEach(button => {
      if (!button.textContent.trim()) {
        const icon = button.querySelector('i, svg');
        if (icon) {
          button.setAttribute('aria-label', 'Knapp'); // Generic label
        }
      }
    });
    
    // Links without accessible names
    const unlabeledLinks = document.querySelectorAll('a:not([aria-label]):not([aria-labelledby])');
    unlabeledLinks.forEach(link => {
      if (!link.textContent.trim()) {
        link.setAttribute('aria-label', 'Länk');
      }
    });
    
    // Images without alt text
    const imagesWithoutAlt = document.querySelectorAll('img:not([alt])');
    imagesWithoutAlt.forEach(img => {
      img.setAttribute('alt', ''); // Decorative image
    });
    
    // Form controls without labels
    const unlabeledInputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
    unlabeledInputs.forEach(input => {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (!label && input.placeholder) {
        input.setAttribute('aria-label', input.placeholder);
      }
    });
  }
  
  /**
   * Enhance form accessibility
   * @private
   */
  enhanceFormAccessibility() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
      // Add form landmark
      if (!form.getAttribute('role')) {
        form.setAttribute('role', 'form');
      }
      
      // Add form name if missing
      if (!form.getAttribute('aria-label') && !form.getAttribute('aria-labelledby')) {
        const heading = form.querySelector('h1, h2, h3, h4, h5, h6');
        if (heading) {
          const headingId = heading.id || `form-heading-${Date.now()}`;
          heading.id = headingId;
          form.setAttribute('aria-labelledby', headingId);
        } else {
          form.setAttribute('aria-label', 'Formulär');
        }
      }
      
      // Enhance required fields
      const requiredFields = form.querySelectorAll('[required]');
      requiredFields.forEach(field => {
        field.setAttribute('aria-required', 'true');
        
        // Add required indicator to label
        const label = document.querySelector(`label[for="${field.id}"]`);
        if (label && !label.querySelector('.required-indicator')) {
          const indicator = document.createElement('span');
          indicator.className = 'required-indicator';
          indicator.textContent = ' *';
          indicator.setAttribute('aria-label', 'obligatoriskt fält');
          label.appendChild(indicator);
        }
      });
      
      // Enhance fieldsets
      const fieldsets = form.querySelectorAll('fieldset');
      fieldsets.forEach(fieldset => {
        const legend = fieldset.querySelector('legend');
        if (!legend) {
          const newLegend = document.createElement('legend');
          newLegend.className = 'sr-only';
          newLegend.textContent = 'Fältgrupp';
          fieldset.insertBefore(newLegend, fieldset.firstChild);
        }
      });
    });
  }
  
  /**
   * Enhance table accessibility
   * @private
   */
  enhanceTableAccessibility() {
    const tables = document.querySelectorAll('table');
    
    tables.forEach(table => {
      // Add table role
      table.setAttribute('role', 'table');
      
      // Add table caption if missing
      if (!table.querySelector('caption') && !table.getAttribute('aria-label')) {
        table.setAttribute('aria-label', 'Datatabell');
      }
      
      // Enhance headers
      const headers = table.querySelectorAll('th');
      headers.forEach((header, index) => {
        if (!header.id) {
          header.id = `table-header-${Date.now()}-${index}`;
        }
        
        if (!header.getAttribute('scope')) {
          // Determine scope based on position
          const row = header.closest('tr');
          const thead = header.closest('thead');
          
          if (thead) {
            header.setAttribute('scope', 'col');
          } else if (row && row.children[0] === header) {
            header.setAttribute('scope', 'row');
          }
        }
      });
      
      // Link cells to headers
      const cells = table.querySelectorAll('td');
      cells.forEach(cell => {
        if (!cell.getAttribute('headers')) {
          const row = cell.closest('tr');
          const cellIndex = Array.from(row.children).indexOf(cell);
          const headerRow = table.querySelector('thead tr, tr:first-child');
          
          if (headerRow) {
            const header = headerRow.children[cellIndex];
            if (header && header.id) {
              cell.setAttribute('headers', header.id);
            }
          }
        }
      });
    });
  }
  
  /**
   * Enhance navigation accessibility
   * @private
   */
  enhanceNavigationAccessibility() {
    // Main navigation
    const navs = document.querySelectorAll('nav');
    navs.forEach((nav, index) => {
      if (!nav.getAttribute('aria-label') && !nav.getAttribute('aria-labelledby')) {
        if (index === 0) {
          nav.setAttribute('aria-label', 'Huvudnavigation');
        } else {
          nav.setAttribute('aria-label', `Navigation ${index + 1}`);
        }
      }
    });
    
    // Breadcrumbs
    const breadcrumbs = document.querySelectorAll('[aria-label*="breadcrumb"], .breadcrumb');
    breadcrumbs.forEach(breadcrumb => {
      breadcrumb.setAttribute('aria-label', 'Brödsmulor');
      
      const links = breadcrumb.querySelectorAll('a');
      links.forEach((link, index) => {
        if (index === links.length - 1) {
          link.setAttribute('aria-current', 'page');
        }
      });
    });
    
    // Pagination
    const paginations = document.querySelectorAll('.pagination');
    paginations.forEach(pagination => {
      pagination.setAttribute('role', 'navigation');
      pagination.setAttribute('aria-label', 'Sidnavigering');
      
      const currentPage = pagination.querySelector('.active a, .current a');
      if (currentPage) {
        currentPage.setAttribute('aria-current', 'page');
      }
    });
  }
  
  /**
   * Set up color contrast support
   * @private
   */
  setupColorContrastSupport() {
    if (!this.options.colorContrast) return;
    
    // Add high contrast mode support
    this.addHighContrastStyles();
    
    // Check for system preferences
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');
    if (prefersHighContrast.matches) {
      this.enableHighContrast();
    }
    
    prefersHighContrast.addListener((e) => {
      if (e.matches) {
        this.enableHighContrast();
      } else {
        this.disableHighContrast();
      }
    });
  }
  
  /**
   * Add high contrast styles
   * @private
   */
  addHighContrastStyles() {
    const style = document.createElement('style');
    style.id = 'high-contrast-styles';
    style.textContent = `
      .high-contrast {
        /* High contrast color scheme for Swedish accessibility */
        --color-text-primary: #000000 !important;
        --color-text-secondary: #000000 !important;
        --color-background-primary: #ffffff !important;
        --color-background-secondary: #f0f0f0 !important;
        --color-border-primary: #000000 !important;
        --color-primary: #0000ff !important;
        --color-primary-hover: #000080 !important;
        
        /* Enhanced contrast for interactive elements */
        filter: contrast(150%);
      }
      
      .high-contrast button,
      .high-contrast .btn {
        border: 2px solid #000000 !important;
        background: #ffffff !important;
        color: #000000 !important;
      }
      
      .high-contrast button:hover,
      .high-contrast .btn:hover {
        background: #000000 !important;
        color: #ffffff !important;
      }
      
      .high-contrast a {
        color: #0000ff !important;
        text-decoration: underline !important;
      }
      
      .high-contrast a:visited {
        color: #800080 !important;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  /**
   * Set up event listeners
   * @private
   */
  setupEventListeners() {
    // Keyboard navigation detection
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        this.isUsingKeyboard = true;
        document.body.classList.add('keyboard-navigation');
      }
    });
    
    document.addEventListener('mousedown', () => {
      this.isUsingKeyboard = false;
      document.body.classList.remove('keyboard-navigation');
    });
    
    // Escape key handling
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.handleEscapeKey(e);
      }
    });
  }
  
  /**
   * Handle keyboard events
   * @param {KeyboardEvent} e - Keyboard event
   * @private
   */
  handleKeyDown(e) {
    const { key, target, ctrlKey, altKey, shiftKey } = e;
    
    // Skip if typing in input
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }
    
    // Keyboard shortcuts for accessibility
    if (ctrlKey && altKey) {
      switch (key) {
        case 'h': // Go to heading
          this.navigateToHeading();
          e.preventDefault();
          break;
        case 'l': // Go to link
          this.navigateToLink();
          e.preventDefault();
          break;
        case 'b': // Go to button
          this.navigateToButton();
          e.preventDefault();
          break;
        case 'f': // Go to form
          this.navigateToForm();
          e.preventDefault();
          break;
        case 't': // Go to table
          this.navigateToTable();
          e.preventDefault();
          break;
        case 'r': // Go to landmark
          this.navigateToLandmark();
          e.preventDefault();
          break;
      }
    }
    
    // Arrow key navigation in certain contexts
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      this.handleArrowNavigation(e);
    }
    
    // Emit navigation event
    if (this.options.onKeyboardNavigation) {
      this.options.onKeyboardNavigation(e);
    }
  }
  
  /**
   * Handle focus events
   * @param {FocusEvent} e - Focus event
   * @private
   */
  handleFocus(e) {
    if (e.type === 'focusin') {
      this.lastFocusedElement = e.target;
      
      // Announce focused element if using screen reader
      if (this.isUsingKeyboard) {
        this.announceFocusedElement(e.target);
      }
    }
    
    if (this.options.onFocusChange) {
      this.options.onFocusChange(e.target, e.type);
    }
  }
  
  /**
   * Handle mouse events
   * @param {MouseEvent} e - Mouse event
   * @private
   */
  handleMouseDown(e) {
    this.isUsingKeyboard = false;
    document.body.classList.remove('keyboard-navigation');
  }
  
  /**
   * Handle click events
   * @param {MouseEvent} e - Click event
   * @private
   */
  handleClick(e) {
    // Ensure clicked element is properly focused
    if (e.target.matches('button, [role="button"], a, input, select, textarea, [tabindex]')) {
      if (document.activeElement !== e.target) {
        e.target.focus();
      }
    }
  }
  
  /**
   * Handle escape key
   * @param {KeyboardEvent} e - Keyboard event
   * @private
   */
  handleEscapeKey(e) {
    // Close modals
    const openModal = document.querySelector('.modal.show');
    if (openModal) {
      const closeButton = openModal.querySelector('[data-bs-dismiss="modal"]');
      if (closeButton) {
        closeButton.click();
      }
      return;
    }
    
    // Close dropdowns
    const openDropdown = document.querySelector('.dropdown.show');
    if (openDropdown) {
      const toggle = openDropdown.querySelector('[data-bs-toggle="dropdown"]');
      if (toggle) {
        toggle.click();
      }
      return;
    }
    
    // Return focus to last focused element
    if (this.lastFocusedElement) {
      this.lastFocusedElement.focus();
    }
  }
  
  /**
   * Handle arrow key navigation
   * @param {KeyboardEvent} e - Keyboard event
   * @private
   */
  handleArrowNavigation(e) {
    const { key, target } = e;
    
    // Navigation in menus
    if (target.closest('[role="menu"], [role="menubar"]')) {
      e.preventDefault();
      this.navigateMenu(target, key);
      return;
    }
    
    // Navigation in tab panels
    if (target.closest('[role="tablist"]')) {
      e.preventDefault();
      this.navigateTabList(target, key);
      return;
    }
    
    // Navigation in grids/tables
    if (target.closest('[role="grid"], table')) {
      this.navigateGrid(target, key);
      return;
    }
  }
  
  /**
   * Navigate to next heading
   */
  navigateToHeading() {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const currentIndex = Array.from(headings).findIndex(h => h === document.activeElement);
    const nextHeading = headings[currentIndex + 1] || headings[0];
    
    if (nextHeading) {
      nextHeading.setAttribute('tabindex', '-1');
      nextHeading.focus();
      this.announce(`Rubrik nivå ${nextHeading.tagName.charAt(1)}: ${nextHeading.textContent}`);
    }
  }
  
  /**
   * Navigate to next link
   */
  navigateToLink() {
    const links = document.querySelectorAll('a[href]');
    const currentIndex = Array.from(links).findIndex(l => l === document.activeElement);
    const nextLink = links[currentIndex + 1] || links[0];
    
    if (nextLink) {
      nextLink.focus();
      this.announce(`Länk: ${nextLink.textContent || nextLink.getAttribute('aria-label')}`);
    }
  }
  
  /**
   * Navigate to next button
   */
  navigateToButton() {
    const buttons = document.querySelectorAll('button, [role="button"]');
    const currentIndex = Array.from(buttons).findIndex(b => b === document.activeElement);
    const nextButton = buttons[currentIndex + 1] || buttons[0];
    
    if (nextButton) {
      nextButton.focus();
      this.announce(`Knapp: ${nextButton.textContent || nextButton.getAttribute('aria-label')}`);
    }
  }
  
  /**
   * Navigate to next form
   */
  navigateToForm() {
    const forms = document.querySelectorAll('form');
    const currentIndex = Array.from(forms).findIndex(f => f.contains(document.activeElement));
    const nextForm = forms[currentIndex + 1] || forms[0];
    
    if (nextForm) {
      const firstInput = nextForm.querySelector('input, select, textarea, button');
      if (firstInput) {
        firstInput.focus();
        this.announce(`Formulär: ${nextForm.getAttribute('aria-label') || 'Namnlöst formulär'}`);
      }
    }
  }
  
  /**
   * Navigate to next table
   */
  navigateToTable() {
    const tables = document.querySelectorAll('table');
    const currentIndex = Array.from(tables).findIndex(t => t.contains(document.activeElement));
    const nextTable = tables[currentIndex + 1] || tables[0];
    
    if (nextTable) {
      nextTable.setAttribute('tabindex', '-1');
      nextTable.focus();
      
      const caption = nextTable.querySelector('caption');
      const label = caption ? caption.textContent : nextTable.getAttribute('aria-label') || 'Tabell';
      this.announce(`Tabell: ${label}`);
    }
  }
  
  /**
   * Navigate to next landmark
   */
  navigateToLandmark() {
    const landmarks = document.querySelectorAll('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], main, nav, header, footer, aside');
    const currentIndex = Array.from(landmarks).findIndex(l => l.contains(document.activeElement));
    const nextLandmark = landmarks[currentIndex + 1] || landmarks[0];
    
    if (nextLandmark) {
      nextLandmark.setAttribute('tabindex', '-1');
      nextLandmark.focus();
      
      const role = nextLandmark.getAttribute('role') || nextLandmark.tagName.toLowerCase();
      const label = nextLandmark.getAttribute('aria-label') || this.getLandmarkLabel(role);
      this.announce(`Landmärke: ${label}`);
    }
  }
  
  /**
   * Get landmark label in Swedish
   * @param {string} role - Landmark role
   * @returns {string} Swedish label
   * @private
   */
  getLandmarkLabel(role) {
    const labels = {
      'main': 'Huvudinnehåll',
      'navigation': 'Navigation',
      'banner': 'Sidhuvud',
      'contentinfo': 'Sidfot',
      'complementary': 'Kompletterande innehåll',
      'nav': 'Navigation',
      'header': 'Sidhuvud',
      'footer': 'Sidfot',
      'aside': 'Sidoinnehåll'
    };
    
    return labels[role] || role;
  }
  
  /**
   * Navigate within menu
   * @param {HTMLElement} target - Current target
   * @param {string} key - Arrow key
   * @private
   */
  navigateMenu(target, key) {
    const menu = target.closest('[role="menu"], [role="menubar"]');
    const items = menu.querySelectorAll('[role="menuitem"]');
    const currentIndex = Array.from(items).indexOf(target);
    
    let nextIndex;
    
    if (key === 'ArrowDown' || key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % items.length;
    } else if (key === 'ArrowUp' || key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    }
    
    if (nextIndex !== undefined && items[nextIndex]) {
      items[nextIndex].focus();
    }
  }
  
  /**
   * Navigate within tab list
   * @param {HTMLElement} target - Current target
   * @param {string} key - Arrow key
   * @private
   */
  navigateTabList(target, key) {
    const tablist = target.closest('[role="tablist"]');
    const tabs = tablist.querySelectorAll('[role="tab"]');
    const currentIndex = Array.from(tabs).indexOf(target);
    
    let nextIndex;
    
    if (key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    }
    
    if (nextIndex !== undefined && tabs[nextIndex]) {
      tabs[nextIndex].focus();
      tabs[nextIndex].click(); // Activate tab
    }
  }
  
  /**
   * Navigate within grid/table
   * @param {HTMLElement} target - Current target
   * @param {string} key - Arrow key
   * @private
   */
  navigateGrid(target, key) {
    const table = target.closest('table, [role="grid"]');
    const cells = table.querySelectorAll('td, th, [role="gridcell"]');
    const currentIndex = Array.from(cells).indexOf(target);
    
    if (currentIndex === -1) return;
    
    const row = target.closest('tr');
    const cellsInRow = row.querySelectorAll('td, th, [role="gridcell"]');
    const colIndex = Array.from(cellsInRow).indexOf(target);
    const rows = table.querySelectorAll('tr');
    const rowIndex = Array.from(rows).indexOf(row);
    
    let nextCell;
    
    switch (key) {
      case 'ArrowRight':
        nextCell = cellsInRow[colIndex + 1];
        break;
      case 'ArrowLeft':
        nextCell = cellsInRow[colIndex - 1];
        break;
      case 'ArrowDown':
        const nextRow = rows[rowIndex + 1];
        if (nextRow) {
          const nextRowCells = nextRow.querySelectorAll('td, th, [role="gridcell"]');
          nextCell = nextRowCells[colIndex];
        }
        break;
      case 'ArrowUp':
        const prevRow = rows[rowIndex - 1];
        if (prevRow) {
          const prevRowCells = prevRow.querySelectorAll('td, th, [role="gridcell"]');
          nextCell = prevRowCells[colIndex];
        }
        break;
    }
    
    if (nextCell) {
      nextCell.focus();
    }
  }
  
  /**
   * Check tab order
   * @private
   */
  checkTabOrder() {
    this.tabbableElements = this.getTabbableElements();
    
    // Check for tab traps
    this.checkTabTraps();
    
    // Check for missing focusable elements
    this.checkMissingFocusableElements();
  }
  
  /**
   * Get all tabbable elements
   * @returns {Array} Tabbable elements
   * @private
   */
  getTabbableElements() {
    const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll(selector))
      .filter(el => {
        return el.offsetWidth > 0 && el.offsetHeight > 0 && 
               getComputedStyle(el).visibility !== 'hidden';
      });
  }
  
  /**
   * Check for tab traps
   * @private
   */
  checkTabTraps() {
    // Implementation for detecting problematic tab sequences
    // This would check for elements that trap focus inappropriately
  }
  
  /**
   * Check for missing focusable elements
   * @private
   */
  checkMissingFocusableElements() {
    // Check for interactive elements that should be focusable
    const interactiveElements = document.querySelectorAll('[onclick], [onkeydown], .clickable');
    
    interactiveElements.forEach(el => {
      if (!el.matches('a, button, input, select, textarea, [tabindex]')) {
        console.warn('Interactive element is not focusable:', el);
        
        // Auto-fix by adding tabindex
        el.setAttribute('tabindex', '0');
        
        // Add keyboard support if missing
        if (!el.hasAttribute('onkeydown')) {
          el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              el.click();
            }
          });
        }
      }
    });
  }
  
  /**
   * Announce focused element
   * @param {HTMLElement} element - Focused element
   * @private
   */
  announceFocusedElement(element) {
    const announcement = this.getElementAnnouncement(element);
    if (announcement) {
      this.announce(announcement);
    }
  }
  
  /**
   * Get element announcement text
   * @param {HTMLElement} element - Element to announce
   * @returns {string} Announcement text
   * @private
   */
  getElementAnnouncement(element) {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    const ariaLabel = element.getAttribute('aria-label');
    const text = element.textContent.trim();
    
    // Custom announcement for different elements
    if (ariaLabel) {
      return ariaLabel;
    }
    
    switch (tagName) {
      case 'button':
        return `Knapp: ${text}`;
      case 'a':
        return `Länk: ${text}`;
      case 'input':
        const type = element.type;
        const label = this.getInputLabel(element);
        return `${this.getInputTypeLabel(type)}: ${label}`;
      case 'select':
        return `Rullgardinsmeny: ${this.getInputLabel(element)}`;
      case 'textarea':
        return `Textområde: ${this.getInputLabel(element)}`;
      default:
        if (role) {
          return `${this.getRoleLabel(role)}: ${text}`;
        }
        return text;
    }
  }
  
  /**
   * Get input label
   * @param {HTMLElement} input - Input element
   * @returns {string} Input label
   * @private
   */
  getInputLabel(input) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) {
      return label.textContent.trim();
    }
    
    return input.getAttribute('aria-label') || input.placeholder || input.name || 'Namnlöst fält';
  }
  
  /**
   * Get input type label in Swedish
   * @param {string} type - Input type
   * @returns {string} Swedish label
   * @private
   */
  getInputTypeLabel(type) {
    const labels = {
      'text': 'Textfält',
      'email': 'E-postfält',
      'password': 'Lösenordsfält',
      'number': 'Nummerfält',
      'tel': 'Telefonfält',
      'url': 'Webbadressfält',
      'search': 'Sökfält',
      'checkbox': 'Kryssruta',
      'radio': 'Alternativknapp',
      'file': 'Filväljare',
      'date': 'Datumfält',
      'time': 'Tidsfält',
      'datetime-local': 'Datum och tid-fält'
    };
    
    return labels[type] || 'Inmatningsfält';
  }
  
  /**
   * Get role label in Swedish
   * @param {string} role - ARIA role
   * @returns {string} Swedish label
   * @private
   */
  getRoleLabel(role) {
    const labels = {
      'button': 'Knapp',
      'link': 'Länk',
      'tab': 'Flik',
      'tabpanel': 'Flikpanel',
      'menu': 'Meny',
      'menuitem': 'Menyalternativ',
      'dialog': 'Dialog',
      'alert': 'Varning',
      'status': 'Status',
      'progressbar': 'Förloppsindikator',
      'slider': 'Skjutreglage',
      'spinbutton': 'Snurrknapp',
      'combobox': 'Kombinationsruta',
      'grid': 'Rutnät',
      'gridcell': 'Rutnätscell',
      'tree': 'Träd',
      'treeitem': 'Trädobjekt'
    };
    
    return labels[role] || role;
  }
  
  /**
   * Enhance element accessibility
   * @param {HTMLElement} element - Element to enhance
   */
  enhanceElementAccessibility(element) {
    // Add missing ARIA attributes
    this.addMissingAriaLabels();
    
    // Check if element needs focus management
    if (element.matches('button, [role="button"], a, input, select, textarea')) {
      if (!element.hasAttribute('tabindex') && element.disabled) {
        element.setAttribute('tabindex', '-1');
      }
    }
    
    // Add keyboard support to interactive elements
    if (element.hasAttribute('onclick') && !element.matches('a, button, input, select, textarea')) {
      element.setAttribute('tabindex', '0');
      element.setAttribute('role', 'button');
      
      element.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          element.click();
        }
      });
    }
  }
  
  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   * @param {string} priority - Priority level (polite, assertive)
   */
  announce(message, priority = 'polite') {
    if (!this.liveRegion || !message) return;
    
    // Queue announcements to avoid conflicts
    this.announceQueue.push({ message, priority });
    
    if (!this.isAnnouncing) {
      this.processAnnounceQueue();
    }
    
    if (this.options.onAnnouncement) {
      this.options.onAnnouncement(message, priority);
    }
  }
  
  /**
   * Process announcement queue
   * @private
   */
  async processAnnounceQueue() {
    if (this.announceQueue.length === 0) {
      this.isAnnouncing = false;
      return;
    }
    
    this.isAnnouncing = true;
    
    const { message, priority } = this.announceQueue.shift();
    
    // Set priority
    this.liveRegion.setAttribute('aria-live', priority);
    
    // Clear and set message
    this.liveRegion.textContent = '';
    
    // Small delay to ensure screen reader picks up the change
    setTimeout(() => {
      this.liveRegion.textContent = message;
      
      // Process next announcement after delay
      setTimeout(() => {
        this.processAnnounceQueue();
      }, 1000);
    }, 100);
  }
  
  /**
   * Enable high contrast mode
   */
  enableHighContrast() {
    document.body.classList.add('high-contrast');
    this.options.highContrast = true;
    this.announce('Högkontrastläge aktiverat');
  }
  
  /**
   * Disable high contrast mode
   */
  disableHighContrast() {
    document.body.classList.remove('high-contrast');
    this.options.highContrast = false;
    this.announce('Högkontrastläge inaktiverat');
  }
  
  /**
   * Toggle high contrast mode
   */
  toggleHighContrast() {
    if (this.options.highContrast) {
      this.disableHighContrast();
    } else {
      this.enableHighContrast();
    }
  }
  
  /**
   * Focus element with announcement
   * @param {HTMLElement|string} element - Element or selector
   * @param {string} announcement - Custom announcement
   */
  focusElement(element, announcement = null) {
    const target = typeof element === 'string' ? document.querySelector(element) : element;
    
    if (!target) return;
    
    target.focus();
    
    if (announcement) {
      this.announce(announcement);
    }
  }
  
  /**
   * Set element as page main content
   * @param {HTMLElement|string} element - Element or selector
   */
  setMainContent(element) {
    const target = typeof element === 'string' ? document.querySelector(element) : element;
    
    if (!target) return;
    
    // Remove existing main landmarks
    document.querySelectorAll('[role="main"], main').forEach(el => {
      if (el !== target) {
        el.removeAttribute('role');
      }
    });
    
    // Set as main content
    target.setAttribute('role', 'main');
    target.id = target.id || 'main-content';
    
    // Update skip links
    const skipLinks = document.querySelectorAll('.skip-link[href="#main-content"]');
    skipLinks.forEach(link => {
      link.href = `#${target.id}`;
    });
  }
  
  /**
   * Check accessibility compliance
   * @returns {object} Compliance report
   */
  checkAccessibility() {
    const issues = [];
    
    // Check for missing alt text
    const imagesWithoutAlt = document.querySelectorAll('img:not([alt])');
    if (imagesWithoutAlt.length > 0) {
      issues.push({
        type: 'missing-alt-text',
        count: imagesWithoutAlt.length,
        severity: 'error',
        message: `${imagesWithoutAlt.length} bilder saknar alt-attribut`
      });
    }
    
    // Check for missing form labels
    const unlabeledInputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
    const unlabeledCount = Array.from(unlabeledInputs).filter(input => {
      return !document.querySelector(`label[for="${input.id}"]`);
    }).length;
    
    if (unlabeledCount > 0) {
      issues.push({
        type: 'missing-form-labels',
        count: unlabeledCount,
        severity: 'error',
        message: `${unlabeledCount} formulärfält saknar etiketter`
      });
    }
    
    // Check for missing headings
    const hasH1 = document.querySelector('h1');
    if (!hasH1) {
      issues.push({
        type: 'missing-h1',
        count: 1,
        severity: 'warning',
        message: 'Sidan saknar h1-rubrik'
      });
    }
    
    // Check color contrast (simplified check)
    const lowContrastElements = this.checkColorContrast();
    if (lowContrastElements.length > 0) {
      issues.push({
        type: 'low-contrast',
        count: lowContrastElements.length,
        severity: 'warning',
        message: `${lowContrastElements.length} element kan ha låg kontrast`
      });
    }
    
    const report = {
      level: this.options.level,
      issues,
      passed: issues.filter(i => i.severity !== 'error').length === issues.length,
      score: Math.max(0, 100 - (issues.length * 10))
    };
    
    console.log('♿ Accessibility Report:', report);
    
    return report;
  }
  
  /**
   * Check color contrast (simplified)
   * @returns {Array} Elements with potential contrast issues
   * @private
   */
  checkColorContrast() {
    // This is a simplified check - in production, you'd use a proper contrast checking library
    const textElements = document.querySelectorAll('p, span, div, a, button, h1, h2, h3, h4, h5, h6');
    const lowContrastElements = [];
    
    textElements.forEach(el => {
      const style = getComputedStyle(el);
      const color = style.color;
      const backgroundColor = style.backgroundColor;
      
      // Simple heuristic - if both colors are similar (same family), flag for review
      if (color && backgroundColor && color !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'rgba(0, 0, 0, 0)') {
        // This would need a proper contrast ratio calculation
        // For now, just flag elements that might need review
        if (this.shouldCheckContrast(color, backgroundColor)) {
          lowContrastElements.push(el);
        }
      }
    });
    
    return lowContrastElements;
  }
  
  /**
   * Simple contrast check heuristic
   * @param {string} color - Text color
   * @param {string} backgroundColor - Background color
   * @returns {boolean} Should check contrast
   * @private
   */
  shouldCheckContrast(color, backgroundColor) {
    // Very simplified - in reality you'd calculate actual contrast ratios
    return color.includes('rgb') && backgroundColor.includes('rgb');
  }
  
  /**
   * Get accessibility report
   * @returns {object} Detailed accessibility report
   */
  getAccessibilityReport() {
    return this.checkAccessibility();
  }
  
  /**
   * Destroy accessibility manager
   */
  destroy() {
    // Remove event listeners
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('focusin', this.handleFocus);
    document.removeEventListener('focusout', this.handleFocus);
    document.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('click', this.handleClick);
    
    // Remove created elements
    if (this.liveRegion && this.liveRegion.parentNode) {
      this.liveRegion.remove();
    }
    
    if (this.skipLinksContainer && this.skipLinksContainer.parentNode) {
      this.skipLinksContainer.remove();
    }
    
    // Remove styles
    const styles = document.querySelectorAll('#high-contrast-styles, style');
    styles.forEach(style => {
      if (style.textContent.includes('skip-link') || style.textContent.includes('high-contrast')) {
        style.remove();
      }
    });
    
    // Remove body classes
    document.body.classList.remove('keyboard-navigation', 'high-contrast');
    
    console.log('♿ AccessibilityManager destroyed');
  }
}

export default AccessibilityManager;