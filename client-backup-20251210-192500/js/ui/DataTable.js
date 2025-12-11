// DataTable Component - Advanced table with search, sort, filter, pagination
// Professionell tabellkomponent för CRM-data med svensk design

import { AppConfig } from '../config/AppConfig.js';

/**
 * DataTable Class - Advanced data table component
 * Features: sorting, filtering, pagination, search, responsive design
 */
export class DataTable {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    
    if (!this.container) {
      throw new Error('DataTable container not found');
    }
    
    this.options = {
      // Data options
      data: options.data || [],
      columns: options.columns || [],
      
      // Feature toggles
      searchable: options.searchable !== false,
      sortable: options.sortable !== false,
      filterable: options.filterable !== false,
      paginated: options.paginated !== false,
      selectable: options.selectable || false,
      
      // Pagination
      pageSize: options.pageSize || 25,
      pageSizeOptions: options.pageSizeOptions || [10, 25, 50, 100],
      
      // Styling
      striped: options.striped !== false,
      hover: options.hover !== false,
      bordered: options.bordered !== false,
      compact: options.compact || false,
      
      // Responsive
      responsive: options.responsive !== false,
      breakpoint: options.breakpoint || 'md',
      
      // Events
      onRowClick: options.onRowClick || null,
      onRowSelect: options.onRowSelect || null,
      onSort: options.onSort || null,
      onFilter: options.onFilter || null,
      onPageChange: options.onPageChange || null,
      
      // Accessibility
      ariaLabel: options.ariaLabel || 'Datatabell',
      
      ...options
    };
    
    // State
    this.data = [...this.options.data];
    this.filteredData = [...this.data];
    this.currentPage = 1;
    this.sortColumn = null;
    this.sortDirection = 'asc';
    this.searchTerm = '';
    this.filters = {};
    this.selectedRows = new Set();
    
    // Elements
    this.elements = {};
    
    this.bindMethods();
  }
  
  /**
   * Initialize data table
   */
  async initialize() {
    this.validateColumns();
    this.createStructure();
    this.render();
    this.setupEventListeners();
    
    console.log('📋 DataTable initialized');
  }
  
  /**
   * Bind methods to maintain context
   * @private
   */
  bindMethods() {
    this.handleSearch = this.handleSearch.bind(this);
    this.handleSort = this.handleSort.bind(this);
    this.handleFilter = this.handleFilter.bind(this);
    this.handlePageChange = this.handlePageChange.bind(this);
    this.handlePageSizeChange = this.handlePageSizeChange.bind(this);
    this.handleRowClick = this.handleRowClick.bind(this);
    this.handleRowSelect = this.handleRowSelect.bind(this);
    this.handleSelectAll = this.handleSelectAll.bind(this);
  }
  
  /**
   * Validate column configuration
   * @private
   */
  validateColumns() {
    if (!Array.isArray(this.options.columns) || this.options.columns.length === 0) {
      throw new Error('DataTable requires columns configuration');
    }
    
    this.options.columns.forEach((col, index) => {
      if (!col.key && !col.render) {
        throw new Error(`Column ${index} requires either 'key' or 'render' property`);
      }
    });
  }
  
  /**
   * Create table structure
   * @private
   */
  createStructure() {
    this.container.className = `datatable-container ${this.container.className}`.trim();
    
    this.container.innerHTML = `
      <div class="datatable-header">
        ${this.options.searchable ? this.createSearchHTML() : ''}
        ${this.options.filterable ? '<div class="datatable-filters"></div>' : ''}
        <div class="datatable-actions">
          <div class="datatable-info">
            <span class="datatable-count"></span>
          </div>
          ${this.options.paginated ? this.createPageSizeHTML() : ''}
        </div>
      </div>
      
      <div class="datatable-wrapper ${this.options.responsive ? 'table-responsive' : ''}">
        <table class="datatable table ${this.getTableClasses()}" 
               role="table" 
               aria-label="${this.options.ariaLabel}">
          <thead class="datatable-head">
            ${this.createHeaderHTML()}
          </thead>
          <tbody class="datatable-body">
          </tbody>
        </table>
      </div>
      
      ${this.options.paginated ? '<div class="datatable-pagination"></div>' : ''}
      
      <div class="datatable-loading" style="display: none;">
        <div class="loading-spinner"></div>
        <span>Laddar data...</span>
      </div>
      
      <div class="datatable-empty" style="display: none;">
        <div class="empty-icon">📊</div>
        <h3>Ingen data att visa</h3>
        <p>Det finns inga poster som matchar dina kriterier.</p>
      </div>
    `;
    
    this.cacheElements();
  }
  
  /**
   * Cache DOM elements
   * @private
   */
  cacheElements() {
    this.elements = {
      header: this.container.querySelector('.datatable-header'),
      search: this.container.querySelector('.datatable-search'),
      filters: this.container.querySelector('.datatable-filters'),
      actions: this.container.querySelector('.datatable-actions'),
      info: this.container.querySelector('.datatable-info'),
      count: this.container.querySelector('.datatable-count'),
      pageSize: this.container.querySelector('.datatable-pagesize'),
      wrapper: this.container.querySelector('.datatable-wrapper'),
      table: this.container.querySelector('.datatable'),
      thead: this.container.querySelector('.datatable-head'),
      tbody: this.container.querySelector('.datatable-body'),
      pagination: this.container.querySelector('.datatable-pagination'),
      loading: this.container.querySelector('.datatable-loading'),
      empty: this.container.querySelector('.datatable-empty')
    };
  }
  
  /**
   * Get table CSS classes
   * @returns {string} CSS classes
   * @private
   */
  getTableClasses() {
    const classes = [];
    
    if (this.options.striped) classes.push('table-striped');
    if (this.options.hover) classes.push('table-hover');
    if (this.options.bordered) classes.push('table-bordered');
    if (this.options.compact) classes.push('table-sm');
    
    return classes.join(' ');
  }
  
  /**
   * Create search HTML
   * @returns {string} Search HTML
   * @private
   */
  createSearchHTML() {
    return `
      <div class="datatable-search">
        <label for="datatable-search-input" class="sr-only">Sök i tabell</label>
        <div class="input-group">
          <span class="input-icon">🔍</span>
          <input type="search" 
                 id="datatable-search-input"
                 class="form-control" 
                 placeholder="Sök..."
                 autocomplete="off">
          <button type="button" class="btn btn-outline-secondary" data-action="clear-search">
            Rensa
          </button>
        </div>
      </div>
    `;
  }
  
  /**
   * Create page size selector HTML
   * @returns {string} Page size HTML
   * @private
   */
  createPageSizeHTML() {
    const options = this.options.pageSizeOptions
      .map(size => `<option value="${size}">${size}</option>`)
      .join('');
    
    return `
      <div class="datatable-pagesize">
        <label for="datatable-pagesize-select">Visa:</label>
        <select id="datatable-pagesize-select" class="form-select form-select-sm">
          ${options}
        </select>
        <span>poster</span>
      </div>
    `;
  }
  
  /**
   * Create table header HTML
   * @returns {string} Header HTML
   * @private
   */
  createHeaderHTML() {
    const selectAllCell = this.options.selectable ? `
      <th class="datatable-select-cell">
        <input type="checkbox" 
               class="form-check-input" 
               data-action="select-all"
               aria-label="Välj alla rader">
      </th>
    ` : '';
    
    const headerCells = this.options.columns.map(column => {
      const sortable = column.sortable !== false && this.options.sortable;
      const sortClass = sortable ? 'sortable' : '';
      const ariaSort = this.getSortAriaAttribute(column.key);
      
      return `
        <th class="datatable-header-cell ${sortClass}" 
            data-column="${column.key || ''}"
            ${ariaSort ? `aria-sort="${ariaSort}"` : ''}
            ${sortable ? 'role="columnheader"' : ''}>
          <div class="header-content">
            <span class="header-text">${column.title || column.key}</span>
            ${sortable ? '<span class="sort-indicator"></span>' : ''}
          </div>
        </th>
      `;
    }).join('');
    
    return `<tr>${selectAllCell}${headerCells}</tr>`;
  }
  
  /**
   * Get aria-sort attribute for column
   * @param {string} columnKey - Column key
   * @returns {string|null} Aria sort value
   * @private
   */
  getSortAriaAttribute(columnKey) {
    if (this.sortColumn === columnKey) {
      return this.sortDirection;
    }
    return null;
  }
  
  /**
   * Set up event listeners
   * @private
   */
  setupEventListeners() {
    // Search
    if (this.elements.search) {
      const searchInput = this.elements.search.querySelector('input');
      const clearButton = this.elements.search.querySelector('[data-action="clear-search"]');
      
      if (searchInput) {
        searchInput.addEventListener('input', this.handleSearch);
        searchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            this.clearSearch();
          }
        });
      }
      
      if (clearButton) {
        clearButton.addEventListener('click', () => this.clearSearch());
      }
    }
    
    // Page size
    if (this.elements.pageSize) {
      const select = this.elements.pageSize.querySelector('select');
      if (select) {
        select.value = this.options.pageSize;
        select.addEventListener('change', this.handlePageSizeChange);
      }
    }
    
    // Table interactions
    if (this.elements.thead) {
      this.elements.thead.addEventListener('click', this.handleSort);
    }
    
    if (this.elements.tbody) {
      this.elements.tbody.addEventListener('click', this.handleRowClick);
      this.elements.tbody.addEventListener('change', this.handleRowSelect);
    }
    
    // Select all
    const selectAllCheckbox = this.container.querySelector('[data-action="select-all"]');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', this.handleSelectAll);
    }
  }
  
  /**
   * Render table data
   */
  render() {
    this.applyFiltersAndSearch();
    this.applySorting();
    this.renderTableBody();
    this.renderPagination();
    this.updateInfo();
    this.updateSelectAllState();
  }
  
  /**
   * Apply search and filters
   * @private
   */
  applyFiltersAndSearch() {
    this.filteredData = this.data.filter(row => {
      // Search filter
      if (this.searchTerm) {
        const searchMatch = this.options.columns.some(column => {
          const value = this.getCellValue(row, column);
          return String(value).toLowerCase().includes(this.searchTerm.toLowerCase());
        });
        
        if (!searchMatch) return false;
      }
      
      // Custom filters
      for (const [filterKey, filterValue] of Object.entries(this.filters)) {
        if (filterValue && !this.applyFilter(row, filterKey, filterValue)) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * Apply sorting
   * @private
   */
  applySorting() {
    if (!this.sortColumn) return;
    
    const column = this.options.columns.find(col => col.key === this.sortColumn);
    if (!column) return;
    
    this.filteredData.sort((a, b) => {
      let valueA = this.getCellValue(a, column);
      let valueB = this.getCellValue(b, column);
      
      // Custom sort function
      if (column.sortFn) {
        return column.sortFn(valueA, valueB, this.sortDirection);
      }
      
      // Default sorting
      if (typeof valueA === 'string') valueA = valueA.toLowerCase();
      if (typeof valueB === 'string') valueB = valueB.toLowerCase();
      
      let comparison = 0;
      if (valueA > valueB) comparison = 1;
      if (valueA < valueB) comparison = -1;
      
      return this.sortDirection === 'desc' ? -comparison : comparison;
    });
  }
  
  /**
   * Render table body
   * @private
   */
  renderTableBody() {
    if (this.filteredData.length === 0) {
      this.showEmptyState();
      return;
    }
    
    this.hideEmptyState();
    
    const startIndex = this.options.paginated 
      ? (this.currentPage - 1) * this.options.pageSize 
      : 0;
    const endIndex = this.options.paginated 
      ? startIndex + this.options.pageSize 
      : this.filteredData.length;
    
    const pageData = this.filteredData.slice(startIndex, endIndex);
    
    const rows = pageData.map((row, index) => {
      const globalIndex = startIndex + index;
      const isSelected = this.selectedRows.has(globalIndex);
      
      const selectCell = this.options.selectable ? `
        <td class="datatable-select-cell">
          <input type="checkbox" 
                 class="form-check-input" 
                 data-row-index="${globalIndex}"
                 ${isSelected ? 'checked' : ''}
                 aria-label="Välj rad">
        </td>
      ` : '';
      
      const dataCells = this.options.columns.map(column => {
        const value = this.getCellValue(row, column);
        const cellContent = column.render ? column.render(value, row, column) : this.formatCellValue(value, column);
        const cellClass = column.className || '';
        
        return `<td class="datatable-cell ${cellClass}" data-column="${column.key || ''}">${cellContent}</td>`;
      }).join('');
      
      return `
        <tr class="datatable-row ${isSelected ? 'selected' : ''}" 
            data-row-index="${globalIndex}"
            role="row">
          ${selectCell}${dataCells}
        </tr>
      `;
    }).join('');
    
    this.elements.tbody.innerHTML = rows;
  }
  
  /**
   * Get cell value from row data
   * @param {object} row - Row data
   * @param {object} column - Column configuration
   * @returns {any} Cell value
   * @private
   */
  getCellValue(row, column) {
    if (column.key) {
      return this.getNestedProperty(row, column.key);
    }
    return row;
  }
  
  /**
   * Get nested property value
   * @param {object} obj - Object
   * @param {string} path - Property path (e.g., 'user.name')
   * @returns {any} Property value
   * @private
   */
  getNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : '';
    }, obj);
  }
  
  /**
   * Format cell value for display
   * @param {any} value - Cell value
   * @param {object} column - Column configuration
   * @returns {string} Formatted value
   * @private
   */
  formatCellValue(value, column) {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (column.type === 'date' && value) {
      return new Date(value).toLocaleDateString('sv-SE');
    }
    
    if (column.type === 'currency' && typeof value === 'number') {
      return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: 'SEK'
      }).format(value);
    }
    
    if (column.type === 'number' && typeof value === 'number') {
      return new Intl.NumberFormat('sv-SE').format(value);
    }
    
    return String(value);
  }
  
  /**
   * Apply custom filter
   * @param {object} row - Row data
   * @param {string} filterKey - Filter key
   * @param {any} filterValue - Filter value
   * @returns {boolean} Whether row passes filter
   * @private
   */
  applyFilter(row, filterKey, filterValue) {
    const column = this.options.columns.find(col => col.key === filterKey);
    if (!column || !column.filter) return true;
    
    const rowValue = this.getCellValue(row, column);
    return column.filter(rowValue, filterValue, row);
  }
  
  /**
   * Render pagination
   * @private
   */
  renderPagination() {
    if (!this.options.paginated || !this.elements.pagination) return;
    
    const totalPages = Math.ceil(this.filteredData.length / this.options.pageSize);
    
    if (totalPages <= 1) {
      this.elements.pagination.style.display = 'none';
      return;
    }
    
    this.elements.pagination.style.display = 'block';
    
    const pagination = this.createPagination(totalPages);
    this.elements.pagination.innerHTML = pagination;
    
    // Set up pagination event listeners
    this.elements.pagination.addEventListener('click', this.handlePageChange);
  }
  
  /**
   * Create pagination HTML
   * @param {number} totalPages - Total number of pages
   * @returns {string} Pagination HTML
   * @private
   */
  createPagination(totalPages) {
    const maxVisiblePages = 5;
    const startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    let pagination = `
      <nav aria-label="Sidnavigering för tabell">
        <ul class="pagination justify-content-center">
          <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
            <button class="page-link" data-page="1" ${this.currentPage === 1 ? 'disabled' : ''}>
              Första
            </button>
          </li>
          <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
            <button class="page-link" data-page="${this.currentPage - 1}" ${this.currentPage === 1 ? 'disabled' : ''}>
              Föregående
            </button>
          </li>
    `;
    
    for (let i = startPage; i <= endPage; i++) {
      pagination += `
        <li class="page-item ${i === this.currentPage ? 'active' : ''}">
          <button class="page-link" data-page="${i}">
            ${i}
            ${i === this.currentPage ? '<span class="sr-only">(nuvarande)</span>' : ''}
          </button>
        </li>
      `;
    }
    
    pagination += `
      <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
        <button class="page-link" data-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? 'disabled' : ''}>
          Nästa
        </button>
      </li>
      <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
        <button class="page-link" data-page="${totalPages}" ${this.currentPage === totalPages ? 'disabled' : ''}>
          Sista
        </button>
      </li>
    </ul>
  </nav>
    `;
    
    return pagination;
  }
  
  /**
   * Update info display
   * @private
   */
  updateInfo() {
    if (!this.elements.count) return;
    
    const total = this.data.length;
    const filtered = this.filteredData.length;
    const start = this.options.paginated 
      ? Math.min((this.currentPage - 1) * this.options.pageSize + 1, filtered)
      : 1;
    const end = this.options.paginated 
      ? Math.min(this.currentPage * this.options.pageSize, filtered)
      : filtered;
    
    let text = '';
    
    if (filtered === 0) {
      text = 'Inga poster att visa';
    } else if (this.options.paginated && filtered > this.options.pageSize) {
      text = `Visar ${start}-${end} av ${filtered} poster`;
      if (filtered < total) {
        text += ` (filtrerade från ${total} totalt)`;
      }
    } else {
      text = `Visar ${filtered} poster`;
      if (filtered < total) {
        text += ` (filtrerade från ${total} totalt)`;
      }
    }
    
    this.elements.count.textContent = text;
  }
  
  /**
   * Show empty state
   * @private
   */
  showEmptyState() {
    this.elements.table.style.display = 'none';
    this.elements.empty.style.display = 'block';
    if (this.elements.pagination) {
      this.elements.pagination.style.display = 'none';
    }
  }
  
  /**
   * Hide empty state
   * @private
   */
  hideEmptyState() {
    this.elements.table.style.display = 'table';
    this.elements.empty.style.display = 'none';
  }
  
  /**
   * Handle search input
   * @param {Event} e - Input event
   * @private
   */
  handleSearch(e) {
    this.searchTerm = e.target.value;
    this.currentPage = 1;
    this.render();
  }
  
  /**
   * Clear search
   */
  clearSearch() {
    if (this.elements.search) {
      const input = this.elements.search.querySelector('input');
      if (input) {
        input.value = '';
        this.searchTerm = '';
        this.currentPage = 1;
        this.render();
        input.focus();
      }
    }
  }
  
  /**
   * Handle column sorting
   * @param {Event} e - Click event
   * @private
   */
  handleSort(e) {
    const headerCell = e.target.closest('.sortable');
    if (!headerCell) return;
    
    const column = headerCell.dataset.column;
    if (!column) return;
    
    // Update sort state
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    
    // Update header UI
    this.updateSortHeaders();
    
    // Reset to first page
    this.currentPage = 1;
    
    // Re-render
    this.render();
    
    // Emit event
    if (this.options.onSort) {
      this.options.onSort(this.sortColumn, this.sortDirection);
    }
  }
  
  /**
   * Update sort header indicators
   * @private
   */
  updateSortHeaders() {
    const headers = this.elements.thead.querySelectorAll('.sortable');
    
    headers.forEach(header => {
      const column = header.dataset.column;
      const indicator = header.querySelector('.sort-indicator');
      
      if (column === this.sortColumn) {
        header.setAttribute('aria-sort', this.sortDirection);
        indicator.textContent = this.sortDirection === 'asc' ? '↑' : '↓';
      } else {
        header.removeAttribute('aria-sort');
        indicator.textContent = '↕';
      }
    });
  }
  
  /**
   * Handle page change
   * @param {Event} e - Click event
   * @private
   */
  handlePageChange(e) {
    if (e.target.tagName !== 'BUTTON') return;
    
    const page = parseInt(e.target.dataset.page);
    if (isNaN(page) || page === this.currentPage) return;
    
    this.currentPage = page;
    this.render();
    
    // Emit event
    if (this.options.onPageChange) {
      this.options.onPageChange(page);
    }
  }
  
  /**
   * Handle page size change
   * @param {Event} e - Change event
   * @private
   */
  handlePageSizeChange(e) {
    this.options.pageSize = parseInt(e.target.value);
    this.currentPage = 1;
    this.render();
  }
  
  /**
   * Handle row click
   * @param {Event} e - Click event
   * @private
   */
  handleRowClick(e) {
    if (e.target.type === 'checkbox') return;
    
    const row = e.target.closest('.datatable-row');
    if (!row) return;
    
    const rowIndex = parseInt(row.dataset.rowIndex);
    const rowData = this.filteredData[rowIndex];
    
    if (this.options.onRowClick) {
      this.options.onRowClick(rowData, rowIndex, e);
    }
  }
  
  /**
   * Handle row selection
   * @param {Event} e - Change event
   * @private
   */
  handleRowSelect(e) {
    if (e.target.type !== 'checkbox' || !e.target.dataset.rowIndex) return;
    
    const rowIndex = parseInt(e.target.dataset.rowIndex);
    
    if (e.target.checked) {
      this.selectedRows.add(rowIndex);
    } else {
      this.selectedRows.delete(rowIndex);
    }
    
    this.updateRowSelectionUI(rowIndex);
    this.updateSelectAllState();
    
    const selectedData = Array.from(this.selectedRows).map(index => this.filteredData[index]);
    
    if (this.options.onRowSelect) {
      this.options.onRowSelect(selectedData, this.selectedRows);
    }
  }
  
  /**
   * Handle select all checkbox
   * @param {Event} e - Change event
   * @private
   */
  handleSelectAll(e) {
    const isChecked = e.target.checked;
    
    // Get current page indices
    const startIndex = this.options.paginated 
      ? (this.currentPage - 1) * this.options.pageSize 
      : 0;
    const endIndex = this.options.paginated 
      ? Math.min(startIndex + this.options.pageSize, this.filteredData.length)
      : this.filteredData.length;
    
    // Update selection
    for (let i = startIndex; i < endIndex; i++) {
      if (isChecked) {
        this.selectedRows.add(i);
      } else {
        this.selectedRows.delete(i);
      }
    }
    
    // Update UI
    this.updateAllRowSelectionUI();
    
    const selectedData = Array.from(this.selectedRows).map(index => this.filteredData[index]);
    
    if (this.options.onRowSelect) {
      this.options.onRowSelect(selectedData, this.selectedRows);
    }
  }
  
  /**
   * Update row selection UI
   * @param {number} rowIndex - Row index
   * @private
   */
  updateRowSelectionUI(rowIndex) {
    const row = this.elements.tbody.querySelector(`[data-row-index="${rowIndex}"]`);
    if (!row) return;
    
    const isSelected = this.selectedRows.has(rowIndex);
    row.classList.toggle('selected', isSelected);
  }
  
  /**
   * Update all row selection UI
   * @private
   */
  updateAllRowSelectionUI() {
    const checkboxes = this.elements.tbody.querySelectorAll('input[type="checkbox"]');
    
    checkboxes.forEach(checkbox => {
      const rowIndex = parseInt(checkbox.dataset.rowIndex);
      const isSelected = this.selectedRows.has(rowIndex);
      
      checkbox.checked = isSelected;
      this.updateRowSelectionUI(rowIndex);
    });
  }
  
  /**
   * Update select all checkbox state
   * @private
   */
  updateSelectAllState() {
    const selectAllCheckbox = this.container.querySelector('[data-action="select-all"]');
    if (!selectAllCheckbox) return;
    
    // Get current page indices
    const startIndex = this.options.paginated 
      ? (this.currentPage - 1) * this.options.pageSize 
      : 0;
    const endIndex = this.options.paginated 
      ? Math.min(startIndex + this.options.pageSize, this.filteredData.length)
      : this.filteredData.length;
    
    let selectedCount = 0;
    for (let i = startIndex; i < endIndex; i++) {
      if (this.selectedRows.has(i)) selectedCount++;
    }
    
    const totalCount = endIndex - startIndex;
    
    selectAllCheckbox.checked = selectedCount === totalCount && totalCount > 0;
    selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalCount;
  }
  
  /**
   * Set table data
   * @param {Array} data - New data
   */
  setData(data) {
    this.data = [...data];
    this.selectedRows.clear();
    this.currentPage = 1;
    this.render();
  }
  
  /**
   * Add row to table
   * @param {object} row - Row data
   * @param {number} index - Insert index (optional)
   */
  addRow(row, index = null) {
    if (index === null) {
      this.data.push(row);
    } else {
      this.data.splice(index, 0, row);
    }
    this.render();
  }
  
  /**
   * Remove row from table
   * @param {number} index - Row index
   */
  removeRow(index) {
    if (index >= 0 && index < this.data.length) {
      this.data.splice(index, 1);
      this.selectedRows.delete(index);
      this.render();
    }
  }
  
  /**
   * Update row data
   * @param {number} index - Row index
   * @param {object} newData - New row data
   */
  updateRow(index, newData) {
    if (index >= 0 && index < this.data.length) {
      this.data[index] = { ...this.data[index], ...newData };
      this.render();
    }
  }
  
  /**
   * Set filter value
   * @param {string} key - Filter key
   * @param {any} value - Filter value
   */
  setFilter(key, value) {
    this.filters[key] = value;
    this.currentPage = 1;
    this.render();
    
    if (this.options.onFilter) {
      this.options.onFilter(key, value, this.filters);
    }
  }
  
  /**
   * Clear all filters
   */
  clearFilters() {
    this.filters = {};
    this.searchTerm = '';
    this.currentPage = 1;
    
    if (this.elements.search) {
      const input = this.elements.search.querySelector('input');
      if (input) input.value = '';
    }
    
    this.render();
  }
  
  /**
   * Get selected row data
   * @returns {Array} Selected rows
   */
  getSelectedRows() {
    return Array.from(this.selectedRows).map(index => this.filteredData[index]);
  }
  
  /**
   * Clear row selection
   */
  clearSelection() {
    this.selectedRows.clear();
    this.updateAllRowSelectionUI();
    this.updateSelectAllState();
  }
  
  /**
   * Export table data
   * @param {string} format - Export format ('json', 'csv')
   * @param {boolean} selectedOnly - Export only selected rows
   * @returns {string} Exported data
   */
  export(format = 'json', selectedOnly = false) {
    const data = selectedOnly ? this.getSelectedRows() : this.filteredData;
    
    if (format === 'csv') {
      return this.exportCSV(data);
    }
    
    return JSON.stringify(data, null, 2);
  }
  
  /**
   * Export data as CSV
   * @param {Array} data - Data to export
   * @returns {string} CSV string
   * @private
   */
  exportCSV(data) {
    if (data.length === 0) return '';
    
    const headers = this.options.columns
      .filter(col => col.key)
      .map(col => col.title || col.key);
    
    const rows = data.map(row => {
      return this.options.columns
        .filter(col => col.key)
        .map(col => {
          const value = this.getCellValue(row, col);
          return `"${String(value).replace(/"/g, '""')}"`;
        });
    });
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
  
  /**
   * Show loading state
   */
  showLoading() {
    this.elements.loading.style.display = 'flex';
    this.elements.table.style.opacity = '0.5';
  }
  
  /**
   * Hide loading state
   */
  hideLoading() {
    this.elements.loading.style.display = 'none';
    this.elements.table.style.opacity = '1';
  }
  
  /**
   * Destroy data table
   */
  destroy() {
    // Remove event listeners
    this.container.removeEventListener('click', this.handleSort);
    this.container.removeEventListener('click', this.handleRowClick);
    this.container.removeEventListener('change', this.handleRowSelect);
    this.container.removeEventListener('click', this.handlePageChange);
    
    // Clear container
    this.container.innerHTML = '';
    this.container.className = this.container.className.replace(/datatable-container/g, '').trim();
    
    // Reset state
    this.data = [];
    this.filteredData = [];
    this.selectedRows.clear();
    this.elements = {};
    
    console.log('📋 DataTable destroyed');
  }
}

export default DataTable;