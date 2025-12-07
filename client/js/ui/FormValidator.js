// Form Validation - Comprehensive form validation with Swedish patterns
// Omfattande formulärvalidering med svenska mönster och tillgänglighet

import { AppConfig } from '../config/AppConfig.js';

/**
 * FormValidator Class - Advanced form validation system
 * Features: real-time validation, custom rules, accessibility, Swedish localization
 */
export class FormValidator {
  constructor(form, options = {}) {
    this.form = typeof form === 'string' ? document.querySelector(form) : form;
    
    if (!this.form || this.form.tagName !== 'FORM') {
      throw new Error('FormValidator requires a valid form element');
    }
    
    this.options = {
      // Validation timing
      validateOnSubmit: options.validateOnSubmit !== false,
      validateOnBlur: options.validateOnBlur !== false,
      validateOnInput: options.validateOnInput || false,
      
      // Error display
      showErrors: options.showErrors !== false,
      errorClass: options.errorClass || 'is-invalid',
      errorContainerClass: options.errorContainerClass || 'invalid-feedback',
      
      // Accessibility
      liveValidation: options.liveValidation !== false,
      focusFirstError: options.focusFirstError !== false,
      
      // Styling
      successClass: options.successClass || 'is-valid',
      successContainerClass: options.successContainerClass || 'valid-feedback',
      
      // Events
      onValidate: options.onValidate || null,
      onSubmit: options.onSubmit || null,
      onError: options.onError || null,
      
      ...options
    };
    
    // State
    this.rules = new Map();
    this.errors = new Map();
    this.touched = new Set();
    this.isValid = false;
    this.isSubmitting = false;
    
    // Swedish validation patterns
    this.patterns = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      phone: /^(\+46|0)[1-9][0-9]{7,8}$/,
      postalCode: /^[0-9]{3}\s?[0-9]{2}$/,
      personnummer: /^[0-9]{6}-?[0-9]{4}$/,
      organisationsnummer: /^[0-9]{6}-?[0-9]{4}$/,
      bankgiro: /^[0-9]{3,4}-?[0-9]{4}$/,
      plusgiro: /^[0-9]{1,8}-?[0-9]$/,
      iban: /^SE[0-9]{2}[0-9]{20}$/
    };
    
    this.bindMethods();
  }
  
  /**
   * Initialize form validator
   */
  async initialize() {
    this.setupEventListeners();
    this.createErrorContainers();
    this.setupAccessibility();
    
    console.log('✅ FormValidator initialized');
  }
  
  /**
   * Bind methods to maintain context
   * @private
   */
  bindMethods() {
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleInput = this.handleInput.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }
  
  /**
   * Set up event listeners
   * @private
   */
  setupEventListeners() {
    if (this.options.validateOnSubmit) {
      this.form.addEventListener('submit', this.handleSubmit);
    }
    
    if (this.options.validateOnBlur) {
      this.form.addEventListener('blur', this.handleBlur, true);
    }
    
    if (this.options.validateOnInput) {
      this.form.addEventListener('input', this.handleInput);
    }
    
    this.form.addEventListener('change', this.handleChange);
  }
  
  /**
   * Create error containers for form fields
   * @private
   */
  createErrorContainers() {
    const fields = this.form.querySelectorAll('input, select, textarea');
    
    fields.forEach(field => {
      if (!field.name) return;
      
      // Skip if error container already exists
      const existingContainer = field.parentNode.querySelector(`.${this.options.errorContainerClass}`);
      if (existingContainer) return;
      
      const errorContainer = document.createElement('div');
      errorContainer.className = this.options.errorContainerClass;
      errorContainer.id = `${field.name}-error`;
      errorContainer.style.display = 'none';
      
      // Insert after field or field group
      const fieldGroup = field.closest('.form-group, .input-group, .form-floating') || field.parentNode;
      fieldGroup.appendChild(errorContainer);
      
      // Link field to error container
      field.setAttribute('aria-describedby', errorContainer.id);
    });
  }
  
  /**
   * Set up accessibility features
   * @private
   */
  setupAccessibility() {
    // Add novalidate to prevent browser validation
    this.form.setAttribute('novalidate', '');
    
    // Create live region for validation announcements
    if (this.options.liveValidation) {
      const liveRegion = document.createElement('div');
      liveRegion.id = `${this.form.id || 'form'}-validation-live`;
      liveRegion.className = 'sr-only';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      
      this.form.appendChild(liveRegion);
      this.liveRegion = liveRegion;
    }
  }
  
  /**
   * Add validation rule
   * @param {string} fieldName - Field name
   * @param {object|function} rule - Validation rule
   * @returns {FormValidator} This instance for chaining
   */
  addRule(fieldName, rule) {
    if (!this.rules.has(fieldName)) {
      this.rules.set(fieldName, []);
    }
    
    const normalizedRule = this.normalizeRule(rule);
    this.rules.get(fieldName).push(normalizedRule);
    
    return this;
  }
  
  /**
   * Add multiple validation rules
   * @param {object} rules - Rules object
   * @returns {FormValidator} This instance for chaining
   */
  addRules(rules) {
    Object.entries(rules).forEach(([fieldName, fieldRules]) => {
      if (Array.isArray(fieldRules)) {
        fieldRules.forEach(rule => this.addRule(fieldName, rule));
      } else {
        this.addRule(fieldName, fieldRules);
      }
    });
    
    return this;
  }
  
  /**
   * Normalize validation rule
   * @param {object|function} rule - Rule definition
   * @returns {object} Normalized rule
   * @private
   */
  normalizeRule(rule) {
    if (typeof rule === 'function') {
      return {
        validate: rule,
        message: 'Ogiltigt värde'
      };
    }
    
    if (typeof rule === 'string') {
      return this.createBuiltInRule(rule);
    }
    
    return {
      validate: rule.validate || (() => true),
      message: rule.message || 'Ogiltigt värde',
      when: rule.when || null,
      ...rule
    };
  }
  
  /**
   * Create built-in validation rule
   * @param {string} ruleType - Rule type
   * @returns {object} Validation rule
   * @private
   */
  createBuiltInRule(ruleType) {
    const rules = {
      required: {
        validate: (value) => value !== null && value !== undefined && String(value).trim() !== '',
        message: 'Detta fält är obligatoriskt'
      },
      
      email: {
        validate: (value) => !value || this.patterns.email.test(value),
        message: 'Ange en giltig e-postadress'
      },
      
      phone: {
        validate: (value) => !value || this.patterns.phone.test(value.replace(/\s/g, '')),
        message: 'Ange ett giltigt telefonnummer (format: 08-123 456 78)'
      },
      
      postalCode: {
        validate: (value) => !value || this.patterns.postalCode.test(value),
        message: 'Ange ett giltigt postnummer (format: 123 45)'
      },
      
      personnummer: {
        validate: (value) => !value || this.validatePersonnummer(value),
        message: 'Ange ett giltigt personnummer (format: YYYYMMDD-XXXX)'
      },
      
      organisationsnummer: {
        validate: (value) => !value || this.validateOrganisationsnummer(value),
        message: 'Ange ett giltigt organisationsnummer'
      },
      
      url: {
        validate: (value) => {
          if (!value) return true;
          try {
            new URL(value);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Ange en giltig webbadress'
      },
      
      number: {
        validate: (value) => !value || !isNaN(Number(value)),
        message: 'Ange ett giltigt nummer'
      },
      
      min: {
        validate: (value, min) => !value || Number(value) >= min,
        message: (min) => `Värdet måste vara minst ${min}`
      },
      
      max: {
        validate: (value, max) => !value || Number(value) <= max,
        message: (max) => `Värdet får vara högst ${max}`
      },
      
      minLength: {
        validate: (value, minLength) => !value || value.length >= minLength,
        message: (minLength) => `Minst ${minLength} tecken krävs`
      },
      
      maxLength: {
        validate: (value, maxLength) => !value || value.length <= maxLength,
        message: (maxLength) => `Högst ${maxLength} tecken tillåtet`
      }
    };
    
    return rules[ruleType] || rules.required;
  }
  
  /**
   * Validate personnummer
   * @param {string} value - Personnummer value
   * @returns {boolean} Valid
   * @private
   */
  validatePersonnummer(value) {
    if (!value) return true;
    
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length !== 12 && cleaned.length !== 10) return false;
    
    const digits = cleaned.length === 12 ? cleaned.slice(2) : cleaned;
    if (digits.length !== 10) return false;
    
    // Luhn algorithm check
    const sum = digits.split('').reduce((acc, digit, index) => {
      let num = parseInt(digit);
      if (index % 2 === 0) {
        num *= 2;
        if (num > 9) num = num - 9;
      }
      return acc + num;
    }, 0);
    
    return sum % 10 === 0;
  }
  
  /**
   * Validate organisationsnummer
   * @param {string} value - Organisationsnummer value
   * @returns {boolean} Valid
   * @private
   */
  validateOrganisationsnummer(value) {
    if (!value) return true;
    
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length !== 10) return false;
    
    // Check that it's a valid org number (starts with 16, 26, 5X, 6X, 7X, 8X, 9X)
    const first = cleaned.substring(0, 2);
    if (!['16', '26'].includes(first) && !/^[5-9]\d$/.test(first)) return false;
    
    // Luhn algorithm check
    const digits = cleaned.split('').map(Number);
    const sum = digits.slice(0, 9).reduce((acc, digit, index) => {
      let num = digit;
      if (index % 2 === 0) {
        num *= 2;
        if (num > 9) num = num - 9;
      }
      return acc + num;
    }, 0);
    
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === digits[9];
  }
  
  /**
   * Validate single field
   * @param {string} fieldName - Field name
   * @param {boolean} showErrors - Whether to show errors
   * @returns {boolean} Field is valid
   */
  validateField(fieldName, showErrors = true) {
    const field = this.form.querySelector(`[name="${fieldName}"]`);
    if (!field) return true;
    
    const rules = this.rules.get(fieldName) || [];
    const value = this.getFieldValue(field);
    const errors = [];
    
    // Run validation rules
    for (const rule of rules) {
      // Check conditional validation
      if (rule.when && !rule.when(this.getFormData())) {
        continue;
      }
      
      let isValid;
      try {
        if (rule.validate.length > 1) {
          // Rule takes additional parameters
          isValid = rule.validate(value, rule.param);
        } else {
          isValid = rule.validate(value);
        }
      } catch (error) {
        console.error(`Validation error for field ${fieldName}:`, error);
        isValid = false;
      }
      
      if (!isValid) {
        const message = typeof rule.message === 'function' 
          ? rule.message(rule.param) 
          : rule.message;
        errors.push(message);
        
        if (!rule.multiple) break; // Stop at first error unless multiple errors allowed
      }
    }
    
    // Update error state
    if (errors.length > 0) {
      this.errors.set(fieldName, errors);
    } else {
      this.errors.delete(fieldName);
    }
    
    // Update UI
    if (showErrors) {
      this.updateFieldUI(field, fieldName, errors);
    }
    
    return errors.length === 0;
  }
  
  /**
   * Validate entire form
   * @param {boolean} showErrors - Whether to show errors
   * @returns {boolean} Form is valid
   */
  validateForm(showErrors = true) {
    const fieldNames = Array.from(this.rules.keys());
    let isValid = true;
    
    // Validate all fields
    fieldNames.forEach(fieldName => {
      const fieldValid = this.validateField(fieldName, showErrors);
      if (!fieldValid) {
        isValid = false;
      }
    });
    
    this.isValid = isValid;
    
    // Emit validation event
    if (this.options.onValidate) {
      this.options.onValidate(isValid, this.getErrors());
    }
    
    // Announce to screen readers
    if (this.liveRegion && showErrors) {
      const errorCount = this.errors.size;
      if (errorCount > 0) {
        this.liveRegion.textContent = `Formuläret innehåller ${errorCount} fel som behöver åtgärdas`;
      } else {
        this.liveRegion.textContent = 'Formuläret är korrekt ifyllt';
      }
    }
    
    return isValid;
  }
  
  /**
   * Get field value
   * @param {HTMLElement} field - Form field
   * @returns {any} Field value
   * @private
   */
  getFieldValue(field) {
    if (field.type === 'checkbox') {
      return field.checked;
    }
    
    if (field.type === 'radio') {
      const checked = this.form.querySelector(`[name="${field.name}"]:checked`);
      return checked ? checked.value : null;
    }
    
    if (field.type === 'file') {
      return field.files;
    }
    
    if (field.tagName === 'SELECT' && field.multiple) {
      return Array.from(field.selectedOptions).map(option => option.value);
    }
    
    return field.value;
  }
  
  /**
   * Get all form data
   * @returns {object} Form data
   */
  getFormData() {
    const formData = new FormData(this.form);
    const data = {};
    
    for (const [key, value] of formData.entries()) {
      if (data[key]) {
        // Multiple values for same key
        if (Array.isArray(data[key])) {
          data[key].push(value);
        } else {
          data[key] = [data[key], value];
        }
      } else {
        data[key] = value;
      }
    }
    
    return data;
  }
  
  /**
   * Update field UI
   * @param {HTMLElement} field - Form field
   * @param {string} fieldName - Field name
   * @param {Array} errors - Field errors
   * @private
   */
  updateFieldUI(field, fieldName, errors) {
    const errorContainer = document.getElementById(`${fieldName}-error`);
    const hasErrors = errors.length > 0;
    
    // Update field classes
    field.classList.remove(this.options.errorClass, this.options.successClass);
    field.classList.add(hasErrors ? this.options.errorClass : this.options.successClass);
    
    // Update aria-invalid
    field.setAttribute('aria-invalid', hasErrors);
    
    // Update error container
    if (errorContainer) {
      if (hasErrors) {
        errorContainer.textContent = errors[0]; // Show first error
        errorContainer.style.display = 'block';
      } else {
        errorContainer.style.display = 'none';
      }
    }
    
    // Update parent container if it has validation styling
    const formGroup = field.closest('.form-group');
    if (formGroup) {
      formGroup.classList.remove('has-error', 'has-success');
      formGroup.classList.add(hasErrors ? 'has-error' : 'has-success');
    }
  }
  
  /**
   * Handle form submission
   * @param {Event} e - Submit event
   * @private
   */
  async handleSubmit(e) {
    e.preventDefault();
    
    if (this.isSubmitting) return;
    
    this.isSubmitting = true;
    
    // Mark all fields as touched
    const fields = this.form.querySelectorAll('[name]');
    fields.forEach(field => this.touched.add(field.name));
    
    // Validate form
    const isValid = this.validateForm(true);
    
    if (isValid) {
      if (this.options.onSubmit) {
        try {
          await this.options.onSubmit(this.getFormData(), this.form);
        } catch (error) {
          console.error('Form submission error:', error);
          if (this.options.onError) {
            this.options.onError(error);
          }
        }
      }
    } else {
      // Focus first error field
      if (this.options.focusFirstError) {
        this.focusFirstError();
      }
      
      if (this.options.onError) {
        this.options.onError(this.getErrors());
      }
    }
    
    this.isSubmitting = false;
  }
  
  /**
   * Handle field blur
   * @param {Event} e - Blur event
   * @private
   */
  handleBlur(e) {
    const field = e.target;
    if (!field.name) return;
    
    this.touched.add(field.name);
    
    if (this.rules.has(field.name)) {
      this.validateField(field.name, true);
    }
  }
  
  /**
   * Handle field input
   * @param {Event} e - Input event
   * @private
   */
  handleInput(e) {
    const field = e.target;
    if (!field.name) return;
    
    // Only validate if field has been touched
    if (this.touched.has(field.name) && this.rules.has(field.name)) {
      // Debounce input validation
      clearTimeout(this.inputTimeout);
      this.inputTimeout = setTimeout(() => {
        this.validateField(field.name, true);
      }, 300);
    }
  }
  
  /**
   * Handle field change
   * @param {Event} e - Change event
   * @private
   */
  handleChange(e) {
    const field = e.target;
    if (!field.name) return;
    
    this.touched.add(field.name);
    
    if (this.rules.has(field.name)) {
      this.validateField(field.name, true);
    }
  }
  
  /**
   * Focus first error field
   * @private
   */
  focusFirstError() {
    const firstErrorField = this.form.querySelector(`.${this.options.errorClass}`);
    if (firstErrorField) {
      firstErrorField.focus();
      
      // Scroll into view if needed
      firstErrorField.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }
  
  /**
   * Get validation errors
   * @returns {object} Validation errors
   */
  getErrors() {
    return Object.fromEntries(this.errors);
  }
  
  /**
   * Get errors for specific field
   * @param {string} fieldName - Field name
   * @returns {Array} Field errors
   */
  getFieldErrors(fieldName) {
    return this.errors.get(fieldName) || [];
  }
  
  /**
   * Clear validation errors
   * @param {string} fieldName - Field name (optional)
   */
  clearErrors(fieldName = null) {
    if (fieldName) {
      this.errors.delete(fieldName);
      const field = this.form.querySelector(`[name="${fieldName}"]`);
      if (field) {
        this.updateFieldUI(field, fieldName, []);
      }
    } else {
      this.errors.clear();
      
      // Clear all field UI
      const fields = this.form.querySelectorAll('[name]');
      fields.forEach(field => {
        this.updateFieldUI(field, field.name, []);
      });
    }
  }
  
  /**
   * Reset form validation
   */
  reset() {
    this.errors.clear();
    this.touched.clear();
    this.isValid = false;
    
    // Reset field UI
    const fields = this.form.querySelectorAll('[name]');
    fields.forEach(field => {
      field.classList.remove(this.options.errorClass, this.options.successClass);
      field.removeAttribute('aria-invalid');
      
      const errorContainer = document.getElementById(`${field.name}-error`);
      if (errorContainer) {
        errorContainer.style.display = 'none';
      }
    });
    
    // Clear live region
    if (this.liveRegion) {
      this.liveRegion.textContent = '';
    }
  }
  
  /**
   * Add custom error
   * @param {string} fieldName - Field name
   * @param {string} message - Error message
   */
  addError(fieldName, message) {
    if (!this.errors.has(fieldName)) {
      this.errors.set(fieldName, []);
    }
    
    this.errors.get(fieldName).push(message);
    
    const field = this.form.querySelector(`[name="${fieldName}"]`);
    if (field) {
      this.updateFieldUI(field, fieldName, this.errors.get(fieldName));
    }
  }
  
  /**
   * Check if form is valid
   * @returns {boolean} Form validity
   */
  valid() {
    return this.validateForm(false);
  }
  
  /**
   * Destroy form validator
   */
  destroy() {
    // Remove event listeners
    this.form.removeEventListener('submit', this.handleSubmit);
    this.form.removeEventListener('blur', this.handleBlur, true);
    this.form.removeEventListener('input', this.handleInput);
    this.form.removeEventListener('change', this.handleChange);
    
    // Clear timeouts
    clearTimeout(this.inputTimeout);
    
    // Remove live region
    if (this.liveRegion && this.liveRegion.parentNode) {
      this.liveRegion.remove();
    }
    
    // Reset state
    this.rules.clear();
    this.errors.clear();
    this.touched.clear();
    
    console.log('✅ FormValidator destroyed');
  }
}

export default FormValidator;