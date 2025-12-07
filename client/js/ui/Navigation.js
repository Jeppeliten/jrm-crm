// Navigation Component - Professional navigation with responsive design
// Professionell navigeringskomponent med responsiv design och tillgänglighet

import { AppConfig } from '../config/AppConfig.js';

/**
 * Navigation Class - Advanced navigation component
 * Features: responsive design, breadcrumbs, dropdown menus, accessibility
 */
export class Navigation {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    
    if (!this.container) {
      throw new Error('Navigation container not found');
    }
    
    this.options = {
      // Navigation type
      type: options.type || 'horizontal', // horizontal, vertical, sidebar
      
      // Features
      responsive: options.responsive !== false,
      collapsible: options.collapsible !== false,
      breadcrumbs: options.breadcrumbs || false,
      dropdowns: options.dropdowns !== false,
      
      // Styling
      brand: options.brand || null,
      theme: options.theme || 'light', // light, dark
      position: options.position || 'static', // static, fixed-top, fixed-bottom, sticky-top
      
      // Responsive
      breakpoint: options.breakpoint || 'lg',
      collapseOn: options.collapseOn || 'md',
      
      // Navigation items
      items: options.items || [],
      
      // Events
      onItemClick: options.onItemClick || null,
      onToggle: options.onToggle || null,
      
      // Accessibility
      ariaLabel: options.ariaLabel || 'Huvudnavigering',
      
      ...options
    };
    
    // State
    this.isExpanded = false;
    this.activeItem = null;
    this.currentPath = window.location.pathname;
    
    // Elements
    this.elements = {};
    
    this.bindMethods();
  }
  
  /**
   * Initialize navigation
   */
  async initialize() {
    this.createStructure();
    this.setupEventListeners();
    this.updateActiveItem();
    
    console.log('🧭 Navigation initialized');
  }
  
  /**
   * Bind methods to maintain context
   * @private
   */
  bindMethods() {
    this.handleToggle = this.handleToggle.bind(this);
    this.handleItemClick = this.handleItemClick.bind(this);
    this.handleDropdownToggle = this.handleDropdownToggle.bind(this);
    this.handleOutsideClick = this.handleOutsideClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }
  
  /**
   * Create navigation structure
   * @private
   */
  createStructure() {
    const navClass = this.getNavigationClasses();
    
    this.container.innerHTML = `
      <nav class="${navClass}" 
           role="navigation" 
           aria-label="${this.options.ariaLabel}">
        ${this.options.brand ? this.createBrandHTML() : ''}
        
        ${this.options.collapsible ? this.createToggleHTML() : ''}
        
        <div class="navbar-collapse ${this.options.collapsible ? 'collapse' : ''}" 
             id="navbarNav">
          ${this.createMenuHTML()}
        </div>
        
        ${this.options.breadcrumbs ? this.createBreadcrumbsHTML() : ''}
      </nav>
    `;
    
    this.cacheElements();
  }
  
  /**
   * Get navigation CSS classes
   * @returns {string} CSS classes
   * @private
   */
  getNavigationClasses() {
    const classes = ['navbar'];
    
    if (this.options.type === 'vertical') {
      classes.push('navbar-vertical');
    } else {
      classes.push('navbar-expand-' + this.options.collapseOn);
    }
    
    classes.push('navbar-' + this.options.theme);
    
    if (this.options.position !== 'static') {
      classes.push(this.options.position);
    }
    
    return classes.join(' ');
  }
  
  /**
   * Create brand HTML
   * @returns {string} Brand HTML
   * @private
   */
  createBrandHTML() {
    const brand = this.options.brand;
    
    if (typeof brand === 'string') {
      return `
        <a class="navbar-brand" href="/">
          ${brand}
        </a>
      `;
    }
    
    return `
      <a class="navbar-brand" href="${brand.href || '/'}">
        ${brand.logo ? `<img src="${brand.logo}" alt="${brand.text}" class="navbar-logo">` : ''}
        ${brand.text ? `<span class="navbar-brand-text">${brand.text}</span>` : ''}
      </a>
    `;
  }
  
  /**
   * Create toggle button HTML
   * @returns {string} Toggle HTML
   * @private
   */
  createToggleHTML() {
    return `
      <button class="navbar-toggler" 
              type="button" 
              data-toggle="collapse"
              data-target="#navbarNav"
              aria-controls="navbarNav"
              aria-expanded="false"
              aria-label="Visa/dölj navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
    `;
  }
  
  /**
   * Create menu HTML
   * @returns {string} Menu HTML
   * @private
   */
  createMenuHTML() {
    const menuItems = this.options.items.map(item => this.createMenuItemHTML(item)).join('');
    
    return `
      <ul class="navbar-nav ${this.options.type === 'vertical' ? 'flex-column' : 'me-auto'}">
        ${menuItems}
      </ul>
    `;
  }
  
  /**
   * Create menu item HTML
   * @param {object} item - Menu item
   * @returns {string} Menu item HTML
   * @private
   */
  createMenuItemHTML(item) {
    if (item.divider) {
      return '<li class="nav-divider"></li>';
    }
    
    if (item.children && item.children.length > 0) {
      return this.createDropdownHTML(item);
    }
    
    const isActive = this.isItemActive(item);
    const classes = ['nav-item'];
    if (isActive) classes.push('active');
    if (item.disabled) classes.push('disabled');
    
    return `
      <li class="${classes.join(' ')}">
        <a class="nav-link ${isActive ? 'active' : ''}" 
           href="${item.href || '#'}"
           ${item.target ? `target="${item.target}"` : ''}
           ${item.disabled ? 'aria-disabled="true"' : ''}
           data-nav-item="${item.id || item.text}">
          ${item.icon ? `<i class="${item.icon}" aria-hidden="true"></i>` : ''}
          <span>${item.text}</span>
          ${isActive ? '<span class="sr-only">(aktuell)</span>' : ''}
        </a>
      </li>
    `;
  }
  
  /**
   * Create dropdown HTML
   * @param {object} item - Dropdown item
   * @returns {string} Dropdown HTML
   * @private
   */
  createDropdownHTML(item) {
    const isActive = item.children.some(child => this.isItemActive(child));
    const dropdownId = `dropdown-${item.id || item.text.replace(/\s/g, '-').toLowerCase()}`;
    
    const childItems = item.children.map(child => {
      if (child.divider) {
        return '<li><hr class="dropdown-divider"></li>';
      }
      
      const childIsActive = this.isItemActive(child);
      
      return `
        <li>
          <a class="dropdown-item ${childIsActive ? 'active' : ''}" 
             href="${child.href || '#'}"
             ${child.target ? `target="${child.target}"` : ''}
             ${child.disabled ? 'aria-disabled="true"' : ''}
             data-nav-item="${child.id || child.text}">
            ${child.icon ? `<i class="${child.icon}" aria-hidden="true"></i>` : ''}
            <span>${child.text}</span>
            ${childIsActive ? '<span class="sr-only">(aktuell)</span>' : ''}
          </a>
        </li>
      `;
    }).join('');
    
    return `
      <li class="nav-item dropdown ${isActive ? 'active' : ''}">
        <a class="nav-link dropdown-toggle ${isActive ? 'active' : ''}" 
           href="#" 
           id="${dropdownId}"
           role="button"
           data-bs-toggle="dropdown"
           aria-expanded="false"
           data-nav-dropdown="${item.id || item.text}">
          ${item.icon ? `<i class="${item.icon}" aria-hidden="true"></i>` : ''}
          <span>${item.text}</span>
        </a>
        <ul class="dropdown-menu" aria-labelledby="${dropdownId}">
          ${childItems}
        </ul>
      </li>
    `;
  }
  
  /**
   * Create breadcrumbs HTML
   * @returns {string} Breadcrumbs HTML
   * @private
   */
  createBreadcrumbsHTML() {
    return `
      <nav aria-label="Brödsmulor" class="breadcrumb-nav">
        <ol class="breadcrumb">
          <li class="breadcrumb-item">
            <a href="/">Hem</a>
          </li>
          <li class="breadcrumb-item active" aria-current="page">
            Aktuell sida
          </li>
        </ol>
      </nav>
    `;
  }
  
  /**
   * Cache DOM elements
   * @private
   */
  cacheElements() {
    this.elements = {
      nav: this.container.querySelector('nav'),
      toggle: this.container.querySelector('.navbar-toggler'),
      collapse: this.container.querySelector('.navbar-collapse'),
      menu: this.container.querySelector('.navbar-nav'),
      breadcrumbs: this.container.querySelector('.breadcrumb-nav')
    };
  }
  
  /**
   * Set up event listeners
   * @private
   */
  setupEventListeners() {
    // Toggle button
    if (this.elements.toggle) {
      this.elements.toggle.addEventListener('click', this.handleToggle);
    }
    
    // Menu items
    if (this.elements.menu) {
      this.elements.menu.addEventListener('click', this.handleItemClick);
    }
    
    // Dropdown toggles
    this.container.addEventListener('click', this.handleDropdownToggle);
    
    // Outside clicks
    document.addEventListener('click', this.handleOutsideClick);
    
    // Keyboard navigation
    this.container.addEventListener('keydown', this.handleKeyDown);
    
    // Window resize
    if (this.options.responsive) {
      window.addEventListener('resize', this.handleResize);
    }
    
    // Route changes
    window.addEventListener('popstate', () => {
      this.currentPath = window.location.pathname;
      this.updateActiveItem();
    });
  }
  
  /**
   * Check if item is active
   * @param {object} item - Menu item
   * @returns {boolean} Is active
   * @private
   */
  isItemActive(item) {
    if (item.active) return true;
    if (!item.href) return false;
    
    // Exact match
    if (item.href === this.currentPath) return true;
    
    // Parent path match (for nested routes)
    if (item.matchPath && this.currentPath.startsWith(item.matchPath)) return true;
    
    return false;
  }
  
  /**
   * Handle toggle button click
   * @param {Event} e - Click event
   * @private
   */
  handleToggle(e) {
    e.preventDefault();
    
    this.isExpanded = !this.isExpanded;
    
    // Update toggle button
    this.elements.toggle.setAttribute('aria-expanded', this.isExpanded);
    
    // Update collapse state
    if (this.isExpanded) {
      this.elements.collapse.classList.add('show');
    } else {
      this.elements.collapse.classList.remove('show');
    }
    
    // Emit event
    if (this.options.onToggle) {
      this.options.onToggle(this.isExpanded);
    }
  }
  
  /**
   * Handle menu item click
   * @param {Event} e - Click event
   * @private
   */
  handleItemClick(e) {
    const link = e.target.closest('[data-nav-item]');
    if (!link) return;
    
    const itemId = link.dataset.navItem;
    const item = this.findItem(itemId);
    
    if (!item) return;
    
    // Handle disabled items
    if (item.disabled) {
      e.preventDefault();
      return;
    }
    
    // Handle custom click handlers
    if (item.onClick) {
      e.preventDefault();
      item.onClick(item, e);
      return;
    }
    
    // Collapse mobile menu after click
    if (this.options.collapsible && this.isExpanded) {
      this.collapse();
    }
    
    // Emit event
    if (this.options.onItemClick) {
      this.options.onItemClick(item, e);
    }
  }
  
  /**
   * Handle dropdown toggle
   * @param {Event} e - Click event
   * @private
   */
  handleDropdownToggle(e) {
    const dropdownToggle = e.target.closest('[data-bs-toggle="dropdown"]');
    if (!dropdownToggle) return;
    
    e.preventDefault();
    
    const dropdown = dropdownToggle.closest('.dropdown');
    const menu = dropdown.querySelector('.dropdown-menu');
    
    const isOpen = dropdown.classList.contains('show');
    
    // Close all other dropdowns
    this.closeAllDropdowns();
    
    if (!isOpen) {
      dropdown.classList.add('show');
      menu.classList.add('show');
      dropdownToggle.setAttribute('aria-expanded', 'true');
    }
  }
  
  /**
   * Handle outside clicks
   * @param {Event} e - Click event
   * @private
   */
  handleOutsideClick(e) {
    if (!this.container.contains(e.target)) {
      this.closeAllDropdowns();
      
      if (this.options.collapsible && this.isExpanded) {
        this.collapse();
      }
    }
  }
  
  /**
   * Handle keyboard navigation
   * @param {Event} e - Keydown event
   * @private
   */
  handleKeyDown(e) {
    const { key } = e;
    
    if (key === 'Escape') {
      this.closeAllDropdowns();
      
      if (this.isExpanded) {
        this.collapse();
        this.elements.toggle?.focus();
      }
    }
    
    // Arrow key navigation within dropdowns
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      const dropdown = e.target.closest('.dropdown');
      if (dropdown && dropdown.classList.contains('show')) {
        e.preventDefault();
        this.navigateDropdown(dropdown, key === 'ArrowDown' ? 1 : -1);
      }
    }
  }
  
  /**
   * Handle window resize
   * @private
   */
  handleResize() {
    // Close mobile menu on desktop
    if (window.innerWidth >= this.getBreakpointValue()) {
      if (this.isExpanded) {
        this.collapse();
      }
    }
  }
  
  /**
   * Navigate dropdown with arrow keys
   * @param {HTMLElement} dropdown - Dropdown element
   * @param {number} direction - Direction (1 for down, -1 for up)
   * @private
   */
  navigateDropdown(dropdown, direction) {
    const items = dropdown.querySelectorAll('.dropdown-item:not([aria-disabled="true"])');
    const currentIndex = Array.from(items).findIndex(item => item === document.activeElement);
    
    let nextIndex = currentIndex + direction;
    
    if (nextIndex < 0) {
      nextIndex = items.length - 1;
    } else if (nextIndex >= items.length) {
      nextIndex = 0;
    }
    
    if (items[nextIndex]) {
      items[nextIndex].focus();
    }
  }
  
  /**
   * Find navigation item by ID
   * @param {string} itemId - Item ID
   * @returns {object|null} Menu item
   * @private
   */
  findItem(itemId) {
    const findInItems = (items) => {
      for (const item of items) {
        if ((item.id || item.text) === itemId) {
          return item;
        }
        
        if (item.children) {
          const found = findInItems(item.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    return findInItems(this.options.items);
  }
  
  /**
   * Close all open dropdowns
   * @private
   */
  closeAllDropdowns() {
    const openDropdowns = this.container.querySelectorAll('.dropdown.show');
    
    openDropdowns.forEach(dropdown => {
      dropdown.classList.remove('show');
      
      const menu = dropdown.querySelector('.dropdown-menu');
      const toggle = dropdown.querySelector('[data-bs-toggle="dropdown"]');
      
      if (menu) menu.classList.remove('show');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  }
  
  /**
   * Get breakpoint value in pixels
   * @returns {number} Breakpoint value
   * @private
   */
  getBreakpointValue() {
    const breakpoints = {
      sm: 576,
      md: 768,
      lg: 992,
      xl: 1200,
      xxl: 1400
    };
    
    return breakpoints[this.options.collapseOn] || 768;
  }
  
  /**
   * Expand mobile menu
   */
  expand() {
    if (!this.options.collapsible) return;
    
    this.isExpanded = true;
    this.elements.toggle?.setAttribute('aria-expanded', 'true');
    this.elements.collapse?.classList.add('show');
    
    if (this.options.onToggle) {
      this.options.onToggle(true);
    }
  }
  
  /**
   * Collapse mobile menu
   */
  collapse() {
    if (!this.options.collapsible) return;
    
    this.isExpanded = false;
    this.elements.toggle?.setAttribute('aria-expanded', 'false');
    this.elements.collapse?.classList.remove('show');
    
    if (this.options.onToggle) {
      this.options.onToggle(false);
    }
  }
  
  /**
   * Update active menu item
   */
  updateActiveItem() {
    // Remove all active states
    const activeItems = this.container.querySelectorAll('.nav-link.active, .nav-item.active');
    activeItems.forEach(item => {
      item.classList.remove('active');
    });
    
    // Find and activate current item
    const links = this.container.querySelectorAll('[data-nav-item]');
    
    links.forEach(link => {
      const itemId = link.dataset.navItem;
      const item = this.findItem(itemId);
      
      if (item && this.isItemActive(item)) {
        link.classList.add('active');
        
        const navItem = link.closest('.nav-item');
        if (navItem) {
          navItem.classList.add('active');
        }
        
        // Mark parent dropdown as active
        const dropdown = link.closest('.dropdown');
        if (dropdown) {
          dropdown.classList.add('active');
          
          const dropdownToggle = dropdown.querySelector('.dropdown-toggle');
          if (dropdownToggle) {
            dropdownToggle.classList.add('active');
          }
        }
      }
    });
  }
  
  /**
   * Set navigation items
   * @param {Array} items - Navigation items
   */
  setItems(items) {
    this.options.items = items;
    
    // Re-create menu
    const menuContainer = this.elements.menu.parentNode;
    menuContainer.innerHTML = this.createMenuHTML();
    this.elements.menu = menuContainer.querySelector('.navbar-nav');
    
    this.updateActiveItem();
  }
  
  /**
   * Add navigation item
   * @param {object} item - Navigation item
   * @param {number} index - Insert index (optional)
   */
  addItem(item, index = null) {
    if (index === null) {
      this.options.items.push(item);
    } else {
      this.options.items.splice(index, 0, item);
    }
    
    this.setItems(this.options.items);
  }
  
  /**
   * Remove navigation item
   * @param {string} itemId - Item ID
   */
  removeItem(itemId) {
    const removeFromItems = (items) => {
      return items.filter(item => {
        if ((item.id || item.text) === itemId) {
          return false;
        }
        
        if (item.children) {
          item.children = removeFromItems(item.children);
        }
        
        return true;
      });
    };
    
    this.options.items = removeFromItems(this.options.items);
    this.setItems(this.options.items);
  }
  
  /**
   * Update breadcrumbs
   * @param {Array} breadcrumbs - Breadcrumb items
   */
  updateBreadcrumbs(breadcrumbs) {
    if (!this.elements.breadcrumbs) return;
    
    const breadcrumbItems = breadcrumbs.map((crumb, index) => {
      const isLast = index === breadcrumbs.length - 1;
      
      if (isLast) {
        return `
          <li class="breadcrumb-item active" aria-current="page">
            ${crumb.text}
          </li>
        `;
      }
      
      return `
        <li class="breadcrumb-item">
          <a href="${crumb.href || '#'}">${crumb.text}</a>
        </li>
      `;
    }).join('');
    
    const breadcrumbList = this.elements.breadcrumbs.querySelector('.breadcrumb');
    if (breadcrumbList) {
      breadcrumbList.innerHTML = breadcrumbItems;
    }
  }
  
  /**
   * Destroy navigation
   */
  destroy() {
    // Remove event listeners
    this.elements.toggle?.removeEventListener('click', this.handleToggle);
    this.elements.menu?.removeEventListener('click', this.handleItemClick);
    this.container.removeEventListener('click', this.handleDropdownToggle);
    this.container.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('click', this.handleOutsideClick);
    window.removeEventListener('resize', this.handleResize);
    
    // Clear container
    this.container.innerHTML = '';
    
    // Reset state
    this.isExpanded = false;
    this.activeItem = null;
    this.elements = {};
    
    console.log('🧭 Navigation destroyed');
  }
}

export default Navigation;