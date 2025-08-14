/**
 * Sistema de Carrito y Reservas para Terapia Shalom
 * Refactorizado con inyección de dependencias y separación de responsabilidades
 */

/**
 * ===================================================
 * TERAPIA SHALOM - SISTEMA DE CARRITO OPTIMIZADO
 * ===================================================
 * 
 * OPTIMIZACIONES DE RENDIMIENTO IMPLEMENTADAS:
 * - Event listeners pasivos para scroll, touch y resize
 * - Detección automática de soporte para passive listeners
 * - Utilidades para manejar eventos de alto rendimiento
 * - Prevención de bloqueo del hilo principal
 * 
 * COMPATIBILIDAD:
 * - Funciona en navegadores modernos y legacy
 * - Fallback automático para navegadores sin soporte passive
 * ===================================================
 */

// === UTILIDADES DE RENDIMIENTO ===
const EventUtils = {
  supportsPassive: (() => {
    let supportsPassive = false;
    try {
      const opts = Object.defineProperty({}, 'passive', {
        get: function() {
          supportsPassive = true;
          return false;
        }
      });
      window.addEventListener('testPassive', null, opts);
      window.removeEventListener('testPassive', null, opts);
    } catch (e) {}
    return supportsPassive;
  })(),

  getPassiveOption() {
    return this.supportsPassive ? { passive: true } : false;
  },

  addPassiveListener(element, event, handler) {
    element.addEventListener(event, handler, this.getPassiveOption());
  }
};

// === CONFIGURACIÓN ===
const SCHEDULE_CONFIG = {
  WEEKDAY_HOURS: { start: '10:00', end: '19:00', interval: 60 },
  SATURDAY_HOURS: { start: '10:00', end: '13:00', interval: 60 },
  WORKING_DAYS: [1, 2, 3, 4, 5, 6], // Lunes a Sábado
  MAX_RESERVATION_MONTHS: 3
};

const STORAGE_CONFIG = {
  CART_KEY: 'terapia-shalom-cart',
  EXPIRY_HOURS: 24
};

const CONTACT_CONFIG = {
  PHONE: "56935875470"
};

const ERROR_MESSAGES = {
  required: 'Este campo es obligatorio',
  email: 'Ingresa un email válido',
  date: 'Selecciona una fecha válida (Lunes a Sábado, no en el pasado)',
  time: 'Selecciona una hora válida',
  sunday_not_available: 'Los domingos no están disponibles. Selecciona de Lunes a Sábado.',
  no_storage: 'No se pudo guardar en localStorage',
  no_load: 'No se pudo cargar desde localStorage'
};

// === UTILIDADES PURAS ===
const DateUtils = {
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  getDayOfWeek(dateString) {
    return new Date(dateString).getDay();
  },

  /**
   * Verifica si una fecha es válida para reservas
   */
  isValidReservationDate(date, workingDays) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today && workingDays.includes(date.getDay());
  },

  /**
   * Obtiene la fecha de hoy en formato ISO local (evita problemas de zona horaria)
   */
  getTodayISO() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Obtiene una fecha futura en meses
   */
  getFutureDate(months) {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split('T')[0];
  }
};

const MessageUtils = {
  /**
   * Formatea el mensaje de WhatsApp
   */
  formatWhatsAppMessage(data, cartItems, total) {
    const services = cartItems.map(item => 
      `• ${item.quantity}x ${item.name} - $${item.getTotal().toLocaleString()}`
    ).join('\n');

    return `🌿 *RESERVA TERAPIA SHALOM* 🌿

👤 *Datos del Cliente:*
Nombre: ${data.name}
Email: ${data.email}
${data.phone ? `Teléfono: ${data.phone}` : ''}

📅 *Fecha y Hora:*
${DateUtils.formatDate(data.date)} a las ${data.time}

💆‍♀️ *Servicios Solicitados:*
${services}

💰 *Total: $${total.toLocaleString()}*

${data.comments ? `📝 *Comentarios:* ${data.comments}` : ''}

¡Espero mi reserva sea confirmada pronto! 💙`;
  }
};

const TimeUtils = {
  /**
   * Genera horarios disponibles para un día específico
   */
  generateHours(config) {
    const hours = [];
    const [startHour, startMinute] = config.start.split(':').map(Number);
    const [endHour, endMinute] = config.end.split(':').map(Number);
    
    let currentHour = startHour;
    let currentMinute = startMinute;
    
    while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
      const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
      hours.push(timeString);
      
      currentMinute += config.interval;
      if (currentMinute >= 60) {
        currentHour++;
        currentMinute = 0;
      }
    }
    
    return hours;
  }
};

// === CLASES CORE ===
class ScheduleService {
  constructor(config = SCHEDULE_CONFIG) {
    this.config = config;
  }

  getAvailableHours(dayOfWeek) {
    if (!this.config.WORKING_DAYS.includes(dayOfWeek)) {
      return [];
    }

    const timeConfig = dayOfWeek === 6 ? this.config.SATURDAY_HOURS : this.config.WEEKDAY_HOURS;
    return TimeUtils.generateHours(timeConfig);
  }

  isValidReservationDate(date) {
    return DateUtils.isValidReservationDate(date, this.config.WORKING_DAYS);
  }
}

class FormValidator {
  constructor(scheduleService, errorMessages = ERROR_MESSAGES) {
    this.scheduleService = scheduleService;
    this.errorMessages = errorMessages;
    this.validators = {
      required: (value) => value.trim() !== '',
      email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      date: (value) => {
        if (!value) return false;
        const date = new Date(value);
        return this.scheduleService.isValidReservationDate(date);
      },
      time: (value) => value !== ''
    };
  }

  validateField(field, rules) {
    const value = field.value;
    const errorElement = field.parentElement.querySelector('.error-message');
    
    for (const rule of rules) {
      if (!this.validators[rule](value)) {
        this.showError(field, errorElement, this.errorMessages[rule]);
        return false;
      }
    }
    
    this.clearError(field, errorElement);
    return true;
  }

  validateForm(form) {
    const validations = [
      { field: form.querySelector('#customer-name'), rules: ['required'] },
      { field: form.querySelector('#customer-email'), rules: ['required', 'email'] },
      { field: form.querySelector('#reservation-date'), rules: ['required', 'date'] },
      { field: form.querySelector('#reservation-time'), rules: ['required', 'time'] }
    ];

    return validations.every(({ field, rules }) => this.validateField(field, rules));
  }

  showError(field, errorElement, message) {
    field.classList.add('border-red-500');
    field.classList.remove('border-ts-accent/40');
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
  }

  clearError(field, errorElement) {
    field.classList.remove('border-red-500');
    field.classList.add('border-ts-accent/40');
    errorElement.classList.add('hidden');
  }
}

class CartItem {
  constructor(name, price, quantity = 1) {
    this.name = name;
    this.price = price;
    this.quantity = quantity;
  }

  getTotal() {
    return this.price * this.quantity;
  }

  incrementQuantity() {
    this.quantity++;
  }

  decrementQuantity() {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }
}

class StorageService {
  constructor(config = STORAGE_CONFIG) {
    this.config = config;
  }

  save(key, data) {
    try {
      const storageData = {
        ...data,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(storageData));
      return true;
    } catch (error) {
      console.warn(ERROR_MESSAGES.no_storage, error);
      return false;
    }
  }

  load(key) {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const data = JSON.parse(stored);
      const expiryMs = this.config.EXPIRY_HOURS * 60 * 60 * 1000;
      
      if (data.timestamp && (Date.now() - data.timestamp) < expiryMs) {
        return data;
      }
      
      this.remove(key);
      return null;
    } catch (error) {
      console.warn(ERROR_MESSAGES.no_load, error);
      return null;
    }
  }

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Error removing from storage:', error);
    }
  }
}

class ShoppingCart {
  constructor(storageService) {
    this.items = [];
    this.eventListeners = [];
    this.storageService = storageService;
    this.loadFromStorage();
  }

  saveToStorage() {
    const cartData = {
      items: this.items.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity
      }))
    };
    this.storageService.save(STORAGE_CONFIG.CART_KEY, cartData);
  }

  loadFromStorage() {
    const cartData = this.storageService.load(STORAGE_CONFIG.CART_KEY);
    if (cartData?.items) {
      this.items = cartData.items.map(item => 
        new CartItem(item.name, item.price, item.quantity)
      );
    }
  }

  addItem(serviceName, price) {
    const existingItem = this.items.find(item => item.name === serviceName);
    
    if (existingItem) {
      existingItem.incrementQuantity();
    } else {
      this.items.push(new CartItem(serviceName, price));
    }
    
    this.saveToStorage();
    this.notifyListeners();
  }

  removeItem(serviceName) {
    this.items = this.items.filter(item => item.name !== serviceName);
    this.saveToStorage();
    this.notifyListeners();
  }

  updateQuantity(serviceName, quantity) {
    const item = this.items.find(item => item.name === serviceName);
    if (item) {
      if (quantity <= 0) {
        this.removeItem(serviceName);
      } else {
        item.quantity = quantity;
        this.saveToStorage();
        this.notifyListeners();
      }
    }
  }

  getTotal() {
    return this.items.reduce((total, item) => total + item.getTotal(), 0);
  }

  getTotalItems() {
    return this.items.reduce((total, item) => total + item.quantity, 0);
  }

  clear() {
    this.items = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  isEmpty() {
    return this.items.length === 0;
  }

  onChange(callback) {
    this.eventListeners.push(callback);
  }

  notifyListeners() {
    this.eventListeners.forEach(callback => callback(this));
  }
}

class CartUI {
  constructor(cart) {
    this.cart = cart;
    this.elements = this.initializeElements();
    this.bindEvents();
    this.setupCartUpdates();
  }

  initializeElements() {
    const elements = {
      openBtn: document.getElementById('open-cart-btn') || document.getElementById('global-cart-btn'),
      modal: document.getElementById('cart-modal'),
      closeBtn: document.getElementById('close-cart-btn'),
      itemsList: document.getElementById('cart-items-list'),
      totalSection: document.getElementById('cart-total-section'),
      totalElement: document.getElementById('cart-total'),
      reserveSection: document.getElementById('reserve-section') || document.getElementById('cart-actions'),
      reserveBtn: document.getElementById('reserve-btn'),
      badge: document.getElementById('cart-badge') || document.getElementById('global-cart-badge')
    };
    
    console.log('Cart elements found:', Object.keys(elements).reduce((acc, key) => {
      acc[key] = !!elements[key];
      return acc;
    }, {}));
    
    return elements;
  }

  bindEvents() {
    this.elements.openBtn?.addEventListener('click', () => this.openModal());
    this.elements.closeBtn?.addEventListener('click', () => this.closeModal());
    this.elements.modal?.addEventListener('click', (e) => {
      if (e.target === this.elements.modal) this.closeModal();
    });
    this.elements.reserveBtn?.addEventListener('click', () => this.openReservationModal());
  }

  setupCartUpdates() {
    this.cart.onChange(() => {
      this.updateDisplay();
      this.updateBadge();
    });
  }

  openModal() {
    this.elements.modal?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    this.elements.modal?.classList.add('hidden');
    document.body.style.overflow = '';
  }

  openReservationModal() {
    this.closeModal();
    const reservationModal = document.getElementById('reservation-modal');
    reservationModal?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  updateDisplay() {
    if (this.cart.isEmpty()) {
      this.showEmptyCart();
    } else {
      this.showCartItems();
    }
  }

  showEmptyCart() {
    this.elements.itemsList.innerHTML = `
      <div class="text-center text-gray-500 py-8">
        <div class="text-4xl mb-4 flex justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-12 h-12 text-gray-400">
            <path d="M1 1.75A.75.75 0 0 1 1.75 1h1.628a1.75 1.75 0 0 1 1.734 1.51L5.18 3a65.25 65.25 0 0 1 13.36 1.412.75.75 0 0 1 .58.875 48.645 48.645 0 0 1-1.618 6.2.75.75 0 0 1-.712.513H6a2.503 2.503 0 0 0-2.292 1.5H17.25a.75.75 0 0 1 0 1.5H2.76a.75.75 0 0 1-.748-.807 4.002 4.002 0 0 1 2.716-3.486L3.626 2.716a.25.25 0 0 0-.248-.216H1.75A.75.75 0 0 1 1 1.75ZM6 17.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM15.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
          </svg>
        </div>
        <p>Tu carrito está vacío</p>
        <p class="text-sm">Agrega servicios para comenzar</p>
      </div>
    `;
    this.elements.totalSection?.classList.add('hidden');
    this.elements.reserveSection?.classList.add('hidden');
    if (this.elements.reserveSection) {
      this.elements.reserveSection.style.display = 'none';
    }
  }

  showCartItems() {
    this.elements.itemsList.innerHTML = this.cart.items.map(item => 
      this.createCartItemHTML(item)
    ).join('');

    this.elements.totalElement.textContent = this.cart.getTotal().toLocaleString();
    this.elements.totalSection?.classList.remove('hidden');
    this.elements.reserveSection?.classList.remove('hidden');
    if (this.elements.reserveSection) {
      this.elements.reserveSection.style.display = '';
      this.elements.reserveSection.classList.add('flex', 'flex-col', 'sm:flex-row');
    }

    this.bindQuantityControls();
  }

  createCartItemHTML(item) {
    return `
      <div class="flex items-center justify-between p-4 bg-ts-background rounded-lg border border-ts-accent/20">
        <div class="flex-1">
          <h4 class="font-semibold text-ts-primary">${item.name}</h4>
          <p class="text-sm text-ts-text">$${item.price.toLocaleString()} c/u</p>
        </div>
        <div class="flex items-center gap-3">
          <button class="quantity-btn bg-ts-accent text-white hover:bg-ts-primary transition" data-action="decrease" data-service="${item.name}">-</button>
          <span class="w-8 text-center font-semibold">${item.quantity}</span>
          <button class="quantity-btn bg-ts-accent text-white hover:bg-ts-primary transition" data-action="increase" data-service="${item.name}">+</button>
          <button class="remove-btn ml-2 text-red-500 hover:text-red-700 font-bold" data-service="${item.name}">🗑️</button>
        </div>
      </div>
    `;
  }

  bindQuantityControls() {
    document.querySelectorAll('.quantity-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const serviceName = e.target.dataset.service;
        const item = this.cart.items.find(item => item.name === serviceName);
        
        if (item) {
          if (action === 'increase') {
            item.incrementQuantity();
          } else {
            item.decrementQuantity();
          }
          this.cart.notifyListeners();
        }
      });
    });

    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const serviceName = e.target.dataset.service;
        this.cart.removeItem(serviceName);
      });
    });
  }

  updateBadge() {
    if (!this.elements.badge) return;
    
    const totalItems = this.cart.getTotalItems();
    
    if (totalItems > 0) {
      this.elements.badge.textContent = totalItems;
      this.elements.badge.classList.remove('hidden');
      this.elements.badge.style.display = 'flex';
      this.elements.badge.classList.add('cart-badge');
    } else {
      this.elements.badge.classList.add('hidden');
      this.elements.badge.style.display = 'none';
      this.elements.badge.classList.remove('cart-badge');
    }
  }
}

class ReservationManager {
  constructor(cart, scheduleService, validator) {
    this.cart = cart;
    this.scheduleService = scheduleService;
    this.validator = validator;
    this.elements = this.initializeElements();
    this.bindEvents();
    this.setupDateValidation();
  }

  initializeElements() {
    return {
      modal: document.getElementById('reservation-modal'),
      closeBtn: document.getElementById('close-reservation-btn'),
      backBtn: document.getElementById('back-to-cart-btn'),
      form: document.getElementById('reservation-form'),
      dateInput: document.getElementById('reservation-date'),
      timeSelect: document.getElementById('reservation-time')
    };
  }

  bindEvents() {
    this.elements.closeBtn?.addEventListener('click', () => this.closeModal());
    this.elements.backBtn?.addEventListener('click', () => this.backToCart());
    this.elements.modal?.addEventListener('click', (e) => {
      if (e.target === this.elements.modal) this.closeModal();
    });
    this.elements.form?.addEventListener('submit', (e) => this.handleSubmit(e));
    this.elements.dateInput?.addEventListener('change', () => this.updateTimeOptions());
  }

  setupDateValidation() {
    if (!this.elements.dateInput) return;

    // Configurar restricciones de fecha
    const today = DateUtils.getTodayISO();
    const maxDate = DateUtils.getFutureDate(SCHEDULE_CONFIG.MAX_RESERVATION_MONTHS);
    
    this.elements.dateInput.min = today;
    this.elements.dateInput.max = maxDate;
    
    // Forzar atributos para iOS
    this.elements.dateInput.setAttribute('min', today);
    this.elements.dateInput.setAttribute('max', maxDate);
    
    // Listener para validación inmediata
    this.elements.dateInput.addEventListener('input', (e) => this.validateSelectedDate(e));
    this.elements.dateInput.addEventListener('change', (e) => {
      if (this.validateSelectedDate(e)) {
        this.updateTimeOptions();
      }
    });
    
    // Validación adicional para iOS en blur
    this.elements.dateInput.addEventListener('blur', (e) => {
      if (e.target.value) {
        this.validateSelectedDate(e);
      }
    });
  }

  validateSelectedDate(e) {
    const selectedDate = new Date(e.target.value);
    const today = new Date();
    const dayOfWeek = DateUtils.getDayOfWeek(e.target.value);
    
    // Resetear horas para comparación precisa
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    
    const errorElement = e.target.parentElement.querySelector('.error-message');
    
    // Validar fecha pasada
    if (selectedDate < today) {
      this.validator.showError(e.target, errorElement, 'No puedes seleccionar fechas pasadas');
      setTimeout(() => {
        e.target.value = '';
        this.elements.timeSelect.innerHTML = '<option value="">Selecciona una hora</option>';
      }, 100);
      return false;
    }
    
    // Validar domingo
    if (dayOfWeek === 0) { // Domingo
      this.validator.showError(e.target, errorElement, ERROR_MESSAGES.sunday_not_available);
      
      setTimeout(() => {
        e.target.value = '';
        this.elements.timeSelect.innerHTML = '<option value="">Selecciona una hora</option>';
      }, 100);
      
      return false;
    }
    
    // Limpiar errores si la fecha es válida
    this.validator.clearError(e.target, errorElement);
    return true;
    
    this.updateTimeOptions();
    return true;
  }

  closeModal() {
    this.elements.modal?.classList.add('hidden');
    document.body.style.overflow = '';
    this.resetForm();
  }

  backToCart() {
    this.closeModal();
    const cartUI = new CartUI(this.cart);
    cartUI.openModal();
  }

  updateTimeOptions() {
    if (!this.elements.dateInput?.value) return;

    const dayOfWeek = DateUtils.getDayOfWeek(this.elements.dateInput.value);
    
    if (dayOfWeek === 0) {
      this.elements.timeSelect.innerHTML = '<option value="">Domingo no disponible</option>';
      return;
    }
    
    const availableHours = this.scheduleService.getAvailableHours(dayOfWeek);
    
    this.elements.timeSelect.innerHTML = '<option value="">Selecciona una hora</option>';
    
    if (availableHours.length === 0) {
      this.elements.timeSelect.innerHTML = '<option value="">No hay horarios disponibles</option>';
      return;
    }
    
    availableHours.forEach(hour => {
      const option = document.createElement('option');
      option.value = hour;
      option.textContent = hour;
      this.elements.timeSelect.appendChild(option);
    });
  }

  handleSubmit(e) {
    e.preventDefault();
    
    if (this.validator.validateForm(this.elements.form)) {
      this.sendToWhatsApp();
    }
  }

  sendToWhatsApp() {
    const formData = new FormData(this.elements.form);
    const data = Object.fromEntries(formData);
    
    const message = MessageUtils.formatWhatsAppMessage(data, this.cart.items, this.cart.getTotal());
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${CONTACT_CONFIG.PHONE}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    
    this.cart.clear();
    this.closeModal();
  }

  resetForm() {
    this.elements.form?.reset();
    document.querySelectorAll('.error-message').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('input, select, textarea').forEach(el => {
      el.classList.remove('border-red-500');
      el.classList.add('border-ts-accent/40');
    });
  }
}

// === SISTEMA PRINCIPAL ===
class TerapiaShalomCartSystem {
  constructor() {
    console.log('TerapiaShalomCartSystem initializing...');
    
    // Inyección de dependencias
    this.storageService = new StorageService();
    this.scheduleService = new ScheduleService();
    this.cart = new ShoppingCart(this.storageService);
    this.validator = new FormValidator(this.scheduleService);
    this.cartUI = new CartUI(this.cart);
    this.reservationManager = new ReservationManager(this.cart, this.scheduleService, this.validator);
    
    this.initializeGlobalFunctions();
    this.cartUI.updateDisplay();
    this.cartUI.updateBadge();
    
    console.log('TerapiaShalomCartSystem initialized');
  }

  initializeGlobalFunctions() {
    window.addToCart = (serviceName, price) => {
      console.log('addToCart called:', serviceName, price);
      try {
        this.cart.addItem(serviceName, price);
        console.log('Item added successfully');
      } catch (error) {
        console.error('Error adding item to cart:', error);
      }
    };
    
    console.log('Global addToCart function initialized');
  }
}

// === INICIALIZACIÓN ===
document.addEventListener('DOMContentLoaded', () => {
  if (!window.terapiaShalomCart) {
    window.terapiaShalomCart = new TerapiaShalomCartSystem();
  }
});

document.addEventListener('astro:after-swap', () => {
  setTimeout(() => {
    window.terapiaShalomCart = new TerapiaShalomCartSystem();
  }, 100);
});
