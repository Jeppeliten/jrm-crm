/**
 * Kalendervy för CRM - visar möten, uppgifter och aktiviteter
 */

class CalendarManager {
  constructor() {
    this.currentDate = new Date();
    this.currentView = 'month'; // month, week, day
    this.events = [];
    this.isOutlookConnected = false;
  }

  /**
   * Visa kalenderdashboard
   */
  showCalendarDashboard() {
    modal.show(`
      <div class="space-y-6 max-w-6xl">
        <!-- Header med navigering -->
        <div class="flex justify-between items-center border-b pb-4">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">📅 Min Kalender</h2>
            <p class="text-gray-600">Översikt över möten, uppgifter och aktiviteter</p>
          </div>
          <div class="flex space-x-3">
            <div class="flex bg-gray-100 rounded-lg p-1">
              <button onclick="calendarManager.setView('day')" 
                      class="px-3 py-1 rounded text-sm ${this.currentView === 'day' ? 'bg-white shadow' : ''}">
                Dag
              </button>
              <button onclick="calendarManager.setView('week')" 
                      class="px-3 py-1 rounded text-sm ${this.currentView === 'week' ? 'bg-white shadow' : ''}">
                Vecka
              </button>
              <button onclick="calendarManager.setView('month')" 
                      class="px-3 py-1 rounded text-sm ${this.currentView === 'month' ? 'bg-white shadow' : ''}">
                Månad
              </button>
            </div>
            <button onclick="calendarManager.addEvent()" class="btn btn-primary">
              ➕ Nytt möte
            </button>
          </div>
        </div>

        <!-- Navigering -->
        <div class="flex justify-between items-center">
          <div class="flex items-center space-x-4">
            <button onclick="calendarManager.previousPeriod()" class="btn btn-outline btn-sm">
              ← Föregående
            </button>
            <h3 class="text-xl font-semibold" id="calendarPeriodTitle">
              ${this.getPeriodTitle()}
            </h3>
            <button onclick="calendarManager.nextPeriod()" class="btn btn-outline btn-sm">
              Nästa →
            </button>
          </div>
          <div class="flex items-center space-x-4">
            <button onclick="calendarManager.goToToday()" class="btn btn-outline btn-sm">
              Idag
            </button>
            <div class="flex items-center space-x-2">
              <div class="w-3 h-3 rounded-full ${this.isOutlookConnected ? 'bg-green-500' : 'bg-gray-400'}"></div>
              <span class="text-sm text-gray-600">
                ${this.isOutlookConnected ? 'Outlook synkad' : 'Offline-läge'}
              </span>
            </div>
          </div>
        </div>

        <!-- Kalenderinnehåll -->
        <div id="calendarContent" class="min-h-96">
          ${this.renderCalendarView()}
        </div>

        <!-- Kommande händelser -->
        <div class="border-t pt-4">
          <h4 class="font-medium mb-3">📋 Kommande händelser (7 dagar)</h4>
          <div id="upcomingEvents" class="space-y-2">
            ${this.renderUpcomingEvents()}
          </div>
        </div>

        <div class="flex justify-end">
          <button onclick="modal.hide()" class="btn btn-secondary">Stäng</button>
        </div>
      </div>
    `);

    // Ladda händelser efter att modalen visas
    this.loadEvents();
  }

  /**
   * Sätt kalendervy
   */
  setView(view) {
    this.currentView = view;
    this.updateCalendarDisplay();
  }

  /**
   * Gå till föregående period
   */
  previousPeriod() {
    switch (this.currentView) {
      case 'day':
        this.currentDate.setDate(this.currentDate.getDate() - 1);
        break;
      case 'week':
        this.currentDate.setDate(this.currentDate.getDate() - 7);
        break;
      case 'month':
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        break;
    }
    this.updateCalendarDisplay();
  }

  /**
   * Gå till nästa period
   */
  nextPeriod() {
    switch (this.currentView) {
      case 'day':
        this.currentDate.setDate(this.currentDate.getDate() + 1);
        break;
      case 'week':
        this.currentDate.setDate(this.currentDate.getDate() + 7);
        break;
      case 'month':
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        break;
    }
    this.updateCalendarDisplay();
  }

  /**
   * Gå till idag
   */
  goToToday() {
    this.currentDate = new Date();
    this.updateCalendarDisplay();
  }

  /**
   * Uppdatera kalendervisning
   */
  updateCalendarDisplay() {
    const titleEl = document.getElementById('calendarPeriodTitle');
    const contentEl = document.getElementById('calendarContent');
    
    if (titleEl) titleEl.textContent = this.getPeriodTitle();
    if (contentEl) contentEl.innerHTML = this.renderCalendarView();
    
    this.loadEvents();
  }

  /**
   * Hämta periodtitel
   */
  getPeriodTitle() {
    const months = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
                   'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
    const days = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

    switch (this.currentView) {
      case 'day':
        return `${days[this.currentDate.getDay()]} ${this.currentDate.getDate()} ${months[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
      case 'week':
        const weekStart = new Date(this.currentDate);
        weekStart.setDate(this.currentDate.getDate() - this.currentDate.getDay() + 1);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `Vecka ${this.getWeekNumber(this.currentDate)} (${weekStart.getDate()}-${weekEnd.getDate()} ${months[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()})`;
      case 'month':
        return `${months[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
    }
  }

  /**
   * Hämta veckonummer
   */
  getWeekNumber(date) {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date - start + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000;
    const dayCount = Math.floor(diff / (1000 * 60 * 60 * 24));
    return Math.ceil((dayCount + start.getDay() + 1) / 7);
  }

  /**
   * Rendera kalendervy
   */
  renderCalendarView() {
    switch (this.currentView) {
      case 'day':
        return this.renderDayView();
      case 'week':
        return this.renderWeekView();
      case 'month':
        return this.renderMonthView();
    }
  }

  /**
   * Rendera dagvy
   */
  renderDayView() {
    const dayEvents = this.getEventsForDate(this.currentDate);
    const hours = Array.from({length: 24}, (_, i) => i);

    return `
      <div class="border rounded-lg">
        <div class="bg-gray-50 px-4 py-2 border-b">
          <h4 class="font-medium">${this.currentDate.toLocaleDateString('sv-SE', {weekday: 'long', day: 'numeric', month: 'long'})}</h4>
        </div>
        <div class="max-h-96 overflow-y-auto">
          ${hours.map(hour => `
            <div class="flex border-b border-gray-100" style="min-height: 60px;">
              <div class="w-16 p-2 text-sm text-gray-500 border-r">
                ${hour.toString().padStart(2, '0')}:00
              </div>
              <div class="flex-1 p-2 relative">
                ${dayEvents.filter(e => new Date(e.start).getHours() === hour).map(event => `
                  <div class="bg-blue-100 border-l-4 border-blue-500 p-2 mb-1 rounded text-sm cursor-pointer hover:bg-blue-200"
                       onclick="calendarManager.showEventDetails('${event.id}')">
                    <div class="font-medium">${event.title}</div>
                    <div class="text-xs text-gray-600">${event.type === 'outlook' ? '📧' : '📋'} ${event.location || ''}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Rendera veckovy
   */
  renderWeekView() {
    const weekStart = new Date(this.currentDate);
    weekStart.setDate(this.currentDate.getDate() - this.currentDate.getDay() + 1);
    
    const weekDays = Array.from({length: 7}, (_, i) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      return day;
    });

    return `
      <div class="border rounded-lg overflow-hidden">
        <!-- Veckodagar header -->
        <div class="grid grid-cols-8 bg-gray-50 border-b">
          <div class="p-3 border-r text-sm font-medium">Tid</div>
          ${weekDays.map(day => `
            <div class="p-3 border-r text-center">
              <div class="text-sm font-medium">${day.toLocaleDateString('sv-SE', {weekday: 'short'})}</div>
              <div class="text-lg ${this.isToday(day) ? 'bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto' : ''}">${day.getDate()}</div>
            </div>
          `).join('')}
        </div>
        
        <!-- Timslots -->
        <div class="max-h-96 overflow-y-auto">
          ${Array.from({length: 24}, (_, hour) => `
            <div class="grid grid-cols-8 border-b border-gray-100" style="min-height: 50px;">
              <div class="p-2 border-r text-xs text-gray-500">${hour.toString().padStart(2, '0')}:00</div>
              ${weekDays.map(day => {
                const dayEvents = this.getEventsForDate(day).filter(e => new Date(e.start).getHours() === hour);
                return `
                  <div class="p-1 border-r border-gray-100 relative">
                    ${dayEvents.map(event => `
                      <div class="bg-blue-100 border-l-2 border-blue-500 p-1 mb-1 rounded text-xs cursor-pointer hover:bg-blue-200"
                           onclick="calendarManager.showEventDetails('${event.id}')">
                        ${event.title}
                      </div>
                    `).join('')}
                  </div>
                `;
              }).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Rendera månadsvy
   */
  renderMonthView() {
    const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
    const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay() + 1);

    const weeks = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= lastDay || weeks.length < 6) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
      if (currentDate.getMonth() !== this.currentDate.getMonth() && weeks.length >= 4) break;
    }

    return `
      <div class="border rounded-lg overflow-hidden">
        <!-- Veckodagar header -->
        <div class="grid grid-cols-7 bg-gray-50 border-b">
          ${['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(day => `
            <div class="p-3 text-center text-sm font-medium border-r last:border-r-0">${day}</div>
          `).join('')}
        </div>
        
        <!-- Kalenderdagar -->
        ${weeks.map(week => `
          <div class="grid grid-cols-7 border-b last:border-b-0">
            ${week.map(day => {
              const dayEvents = this.getEventsForDate(day);
              const isCurrentMonth = day.getMonth() === this.currentDate.getMonth();
              const isToday = this.isToday(day);
              
              return `
                <div class="p-2 border-r last:border-r-0 min-h-24 ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : ''} ${isToday ? 'bg-blue-50' : ''}">
                  <div class="flex justify-between items-start mb-1">
                    <span class="text-sm ${isToday ? 'bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center' : ''}">${day.getDate()}</span>
                    ${dayEvents.length > 0 ? `<span class="text-xs bg-blue-100 text-blue-800 px-1 rounded">${dayEvents.length}</span>` : ''}
                  </div>
                  <div class="space-y-1">
                    ${dayEvents.slice(0, 2).map(event => `
                      <div class="text-xs bg-blue-100 text-blue-800 p-1 rounded truncate cursor-pointer hover:bg-blue-200"
                           onclick="calendarManager.showEventDetails('${event.id}')">
                        ${event.type === 'outlook' ? '📧' : '📋'} ${event.title}
                      </div>
                    `).join('')}
                    ${dayEvents.length > 2 ? `<div class="text-xs text-gray-500">+${dayEvents.length - 2} till</div>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Kontrollera om datum är idag
   */
  isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  /**
   * Hämta händelser för specifikt datum
   */
  getEventsForDate(date) {
    return this.events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.toDateString() === date.toDateString();
    });
  }

  /**
   * Ladda händelser från olika källor
   */
  async loadEvents() {
    this.events = [];

    // Ladda CRM-uppgifter
    await this.loadCRMTasks();

    // Ladda Outlook-möten om ansluten
    if (typeof outlookIntegration !== 'undefined' && outlookIntegration.isAuthenticated) {
      await this.loadOutlookEvents();
      this.isOutlookConnected = true;
    }

    // Uppdatera kommande händelser
    this.updateUpcomingEvents();
  }

  /**
   * Ladda CRM-uppgifter
   */
  async loadCRMTasks() {
    const tasks = AppState.tasks || [];
    
    tasks.forEach(task => {
      if (task.dueDate) {
        this.events.push({
          id: `crm_${task.id}`,
          title: task.title || task.text,
          start: task.dueDate,
          end: task.dueDate,
          type: 'crm',
          source: 'CRM Uppgift',
          description: task.text,
          priority: task.priority || 'normal',
          entityType: task.entityType,
          entityId: task.entityId
        });
      }
    });
  }

  /**
   * Ladda Outlook-händelser
   */
  async loadOutlookEvents() {
    try {
      const meetings = await outlookIntegration.getUpcomingMeetings(30); // 30 dagar
      
      meetings.forEach(meeting => {
        this.events.push({
          id: `outlook_${meeting.id}`,
          title: meeting.subject,
          start: meeting.start,
          end: meeting.end,
          type: 'outlook',
          source: 'Outlook',
          location: meeting.location,
          attendees: meeting.attendees
        });
      });
    } catch (error) {
      console.error('Kunde inte ladda Outlook-händelser:', error);
    }
  }

  /**
   * Rendera kommande händelser
   */
  renderUpcomingEvents() {
    const upcoming = this.events
      .filter(event => new Date(event.start) >= new Date())
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, 5);

    if (upcoming.length === 0) {
      return '<p class="text-gray-500 text-center py-4">Inga kommande händelser</p>';
    }

    return upcoming.map(event => `
      <div class="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
           onclick="calendarManager.showEventDetails('${event.id}')">
        <div class="flex items-center space-x-3">
          <div class="text-2xl">${event.type === 'outlook' ? '📧' : '📋'}</div>
          <div>
            <p class="font-medium">${event.title}</p>
            <p class="text-sm text-gray-600">
              ${new Date(event.start).toLocaleDateString('sv-SE')} 
              ${new Date(event.start).toLocaleTimeString('sv-SE', {hour: '2-digit', minute: '2-digit'})}
              ${event.location ? `• ${event.location}` : ''}
            </p>
          </div>
        </div>
        <div class="text-sm text-gray-500">${event.source}</div>
      </div>
    `).join('');
  }

  /**
   * Uppdatera kommande händelser
   */
  updateUpcomingEvents() {
    const container = document.getElementById('upcomingEvents');
    if (container) {
      container.innerHTML = this.renderUpcomingEvents();
    }
  }

  /**
   * Visa händelsedetaljer
   */
  showEventDetails(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return;

    modal.show(`
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold">${event.type === 'outlook' ? '📧' : '📋'} ${event.title}</h3>
          <span class="text-sm bg-gray-100 px-2 py-1 rounded">${event.source}</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Starttid</label>
            <p class="text-sm">${new Date(event.start).toLocaleString('sv-SE')}</p>
          </div>
          
          ${event.end ? `
            <div>
              <label class="block text-sm font-medium text-gray-700">Sluttid</label>
              <p class="text-sm">${new Date(event.end).toLocaleString('sv-SE')}</p>
            </div>
          ` : ''}
          
          ${event.location ? `
            <div>
              <label class="block text-sm font-medium text-gray-700">Plats</label>
              <p class="text-sm">${event.location}</p>
            </div>
          ` : ''}
          
          ${event.attendees ? `
            <div>
              <label class="block text-sm font-medium text-gray-700">Deltagare</label>
              <p class="text-sm">${event.attendees.map(a => a.emailAddress?.address || a).join(', ')}</p>
            </div>
          ` : ''}
        </div>

        ${event.description ? `
          <div>
            <label class="block text-sm font-medium text-gray-700">Beskrivning</label>
            <p class="text-sm text-gray-600">${event.description}</p>
          </div>
        ` : ''}

        <div class="flex justify-between">
          <div class="space-x-2">
            ${event.type === 'outlook' ? `
              <button onclick="outlookIntegration.editMeeting('${event.id.replace('outlook_', '')}')" class="btn btn-outline btn-sm">
                ✏️ Redigera
              </button>
            ` : `
              <button onclick="calendarManager.editCRMTask('${event.id.replace('crm_', '')}')" class="btn btn-outline btn-sm">
                ✏️ Redigera
              </button>
            `}
          </div>
          <button onclick="modal.hide()" class="btn btn-secondary">Stäng</button>
        </div>
      </div>
    `);
  }

  /**
   * Lägg till ny händelse
   */
  addEvent() {
    modal.show(`
      <div class="space-y-4">
        <h3 class="text-lg font-bold">➕ Ny händelse</h3>
        
        <div class="flex space-x-3 mb-4">
          <button onclick="calendarManager.addCRMTask()" class="btn btn-outline flex-1">
            📋 CRM Uppgift
          </button>
          <button onclick="calendarManager.addOutlookMeeting()" class="btn btn-outline flex-1">
            📧 Outlook Möte
          </button>
        </div>

        <div class="flex justify-end">
          <button onclick="modal.hide()" class="btn btn-secondary">Avbryt</button>
        </div>
      </div>
    `);
  }

  /**
   * Lägg till CRM-uppgift
   */
  addCRMTask() {
    modal.hide();
    openTaskModal({entityType: 'general', entityId: null});
  }

  /**
   * Lägg till Outlook-möte
   */
  addOutlookMeeting() {
    modal.hide();
    if (typeof outlookIntegration !== 'undefined') {
      outlookIntegration.showScheduleMeeting();
    } else {
      showNotification('Outlook-integration är inte tillgänglig', 'error');
    }
  }

  /**
   * Redigera CRM-uppgift
   */
  editCRMTask(taskId) {
    modal.hide();
    openTaskModal({entityType: 'general', entityId: null, taskId: taskId});
  }
}

// Skapa global instans
const calendarManager = new CalendarManager();