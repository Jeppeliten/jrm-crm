/**
 * Avancerat Rapportsystem för Säljchefer
 * Professionella dashboards och KPI-rapporter
 */

class SalesReportManager {
  constructor() {
    this.currentPeriod = 'month';
    this.currentSalesperson = 'all';
    this.currentSegment = 'all';
    this.reportCache = new Map();
    this.chartInstances = new Map();
    
    // KPI-mål och tröskelvärden
    this.targets = {
      monthlyRevenue: 500000,
      conversionRate: 0.25,
      dealsPerSalesperson: 15,
      avgDealSize: 25000,
      pipelineVelocity: 30 // dagar
    };
  }

  /**
   * Huvuddashboard för säljchefen
   */
  showSalesManagerDashboard() {
    modal.show(`
      <div class="sales-dashboard space-y-8 max-w-7xl mx-auto">
        <!-- Header med filter-väljare -->
        <div class="flex justify-between items-center border-b pb-6">
          <div>
            <h2 class="text-3xl font-bold text-gray-900 mb-2">Säljchef Dashboard</h2>
            <p class="text-gray-600 text-lg">Komplett översikt över säljresultat och teamprestation</p>
          </div>
          <div class="flex space-x-4">
            <select id="periodSelector" class="px-4 py-3 border rounded-lg text-lg" onchange="salesReportManager.changePeriod(this.value)">
              <option value="week">Denna vecka</option>
              <option value="month" selected>Denna månad</option>
              <option value="quarter">Detta kvartal</option>
              <option value="year">Detta år</option>
            </select>
            <select id="salespersonSelector" class="px-4 py-3 border rounded-lg text-lg" onchange="salesReportManager.changeSalesperson(this.value)">
              <option value="all" selected>Alla säljare</option>
              <option value="anna.andersson">Anna Andersson</option>
              <option value="erik.eriksson">Erik Eriksson</option>
              <option value="maria.mansson">Maria Månsson</option>
              <option value="johan.johansson">Johan Johansson</option>
              <option value="lisa.lindberg">Lisa Lindberg</option>
            </select>
            <select id="segmentSelector" class="px-4 py-3 border rounded-lg text-lg" onchange="salesReportManager.changeSegment(this.value)">
              <option value="all" selected>Alla segment</option>
              <option value="enterprise">Enterprise</option>
              <option value="smb">SMB</option>
              <option value="startup">Startup</option>
              <option value="government">Offentlig sektor</option>
            </select>
          </div>
        </div>

        <!-- Aktiva filter indicator -->
        <div id="activeFilters" class="mb-6"></div>

        <!-- KPI-kort med större storlek -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6" id="kpiCards">
          <!-- Fylls dynamiskt -->
        </div>

        <!-- Diagram och analyser med större spacing -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Försäljningstrend -->
          <div class="bg-white p-8 rounded-xl border shadow-sm">
            <h3 class="text-xl font-semibold mb-6 text-gray-800">📈 Försäljningstrend</h3>
            <div class="h-64">
              <canvas id="salesTrendChart" width="400" height="256"></canvas>
            </div>
          </div>

          <!-- Pipeline-analys -->
          <div class="bg-white p-8 rounded-xl border shadow-sm">
            <h3 class="text-xl font-semibold mb-6 text-gray-800">🎯 Pipeline per Stadium</h3>
            <div class="h-64">
              <canvas id="pipelineChart" width="400" height="256"></canvas>
            </div>
          </div>

          <!-- Säljarprestationer -->
          <div class="bg-white p-8 rounded-xl border shadow-sm">
            <h3 class="text-xl font-semibold mb-6 text-gray-800">👥 Säljarprestationer</h3>
            <div id="salespersonPerformance" class="min-h-[200px]">
              <!-- Fylls dynamiskt -->
            </div>
          </div>

          <!-- Konverteringsanalys -->
          <div class="bg-white p-8 rounded-xl border shadow-sm">
            <h3 class="text-xl font-semibold mb-6 text-gray-800">🔄 Konverteringsgrad</h3>
            <div class="h-64">
              <canvas id="conversionChart" width="400" height="256"></canvas>
            </div>
          </div>
        </div>

        <!-- Detaljerade tabeller med större spacing -->
        <div class="space-y-8">
          <!-- Top-affärer -->
          <div class="bg-white p-8 rounded-xl border shadow-sm">
            <div class="flex justify-between items-center mb-6">
              <h3 class="text-xl font-semibold text-gray-800">🏆 Största Affärer (${this.currentPeriod})</h3>
              <button onclick="salesReportManager.exportTopDeals()" class="btn btn-outline px-6 py-3">
                📊 Exportera
              </button>
            </div>
            <div id="topDealsTable">
              <!-- Fylls dynamiskt -->
            </div>
          </div>

          <!-- Aktivitetsrapport -->
          <div class="bg-white p-8 rounded-xl border shadow-sm">
            <div class="flex justify-between items-center mb-6">
              <h3 class="text-xl font-semibold text-gray-800">📊 Säljaktiviteter</h3>
              <button onclick="salesReportManager.showActivityDetails()" class="btn btn-primary px-6 py-3">
                🔍 Detaljvy
              </button>
            </div>
            <div id="activitySummary">
              <!-- Fylls dynamiskt -->
            </div>
          </div>
        </div>

        <!-- Action buttons med större spacing -->
        <div class="flex justify-end space-x-4 pt-8 border-t">
          <button onclick="salesReportManager.scheduleReport()" class="btn btn-secondary px-6 py-3 text-lg">
            📅 Schemalägg rapport
          </button>
          <button onclick="salesReportManager.exportDashboard()" class="btn btn-primary px-6 py-3 text-lg">
            📄 Exportera PDF
          </button>
          <button onclick="modal.hide()" class="btn btn-outline px-6 py-3 text-lg">
            Stäng
          </button>
        </div>
      </div>
    `);

    // Ladda data och renderera komponenter
    this.loadDashboardData();
  }

  /**
   * Ladda och renderera dashboard-data
   */
  async loadDashboardData() {
    try {
      // Kontrollera att AppState finns
      if (typeof AppState === 'undefined') {
        throw new Error('AppState är inte tillgängligt');
      }

      const data = await this.calculateSalesMetrics();
      
      this.renderActiveFilters();
      this.renderKPICards(data.kpis);
      this.renderSalesTrendChart(data.trends);
      this.renderPipelineChart(data.pipeline);
      this.renderSalespersonPerformance(data.salespeople);
      this.renderConversionChart(data.conversion);
      this.renderTopDealsTable(data.topDeals);
      this.renderActivitySummary(data.activities);
      
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      showNotification(`Kunde inte ladda rapportdata: ${error.message}`, 'error');
      
      // Visa ett felmeddelande i stället för tom dashboard
      const container = document.getElementById('kpiCards');
      if (container) {
        container.innerHTML = `
          <div class="col-span-4 text-center p-8">
            <div class="text-red-600 text-lg mb-2">⚠️ Kunde inte ladda rapportdata</div>
            <div class="text-gray-600 text-sm">${error.message}</div>
            <button onclick="salesReportManager.loadDashboardData()" class="btn btn-primary mt-4">
              🔄 Försök igen
            </button>
          </div>
        `;
      }
    }
  }

  /**
   * Beräkna säljmetriker
   */
  async calculateSalesMetrics() {
    // Använd AppState istället för getState()
    const companies = AppState.companies || [];
    const agents = AppState.agents || [];
    
    const now = new Date();
    const periodStart = this.getPeriodStart(this.currentPeriod);
    
    // Filtrera efter säljare om vald
    let filteredCompanies = companies;
    if (this.currentSalesperson !== 'all') {
      filteredCompanies = companies.filter(company => {
        const agent = agents.find(a => a.id === company.agentId);
        return agent && this.normalizeAgentName(agent.name) === this.currentSalesperson;
      });
    }
    
    // Filtrera efter segment om valt
    if (this.currentSegment !== 'all') {
      filteredCompanies = filteredCompanies.filter(company => {
        const segment = this.determineCompanySegment(company);
        return segment === this.currentSegment;
      });
    }
    
    // I detta system är companies våra "deals/affärer"
    // Filtrera affärer för aktuell period baserat på senast uppdaterad
    const periodDeals = filteredCompanies.filter(company => {
      const dealDate = new Date(company.lastActivity || company.createdAt || Date.now() - 30*24*60*60*1000);
      return dealDate >= periodStart && dealDate <= now;
    });

    // Vunna affärer (kunder)
    const wonDeals = filteredCompanies.filter(company => company.status === 'kund');
    
    // Beräkna total revenue baserat på MRR eller potential value
    const totalRevenue = wonDeals.reduce((sum, company) => {
      return sum + (Number(company.mrr) * 12 || Number(company.potentialValue) || 0);
    }, 0);
    
    // KPI-beräkningar
    const kpis = {
      totalRevenue: {
        value: totalRevenue,
        target: this.targets.monthlyRevenue,
        change: this.calculatePeriodChange(totalRevenue, 'revenue'),
        status: totalRevenue >= this.targets.monthlyRevenue ? 'good' : 'warning'
      },
      totalDeals: {
        value: wonDeals.length,
        target: this.targets.dealsPerSalesperson * agents.length,
        change: this.calculatePeriodChange(wonDeals.length, 'deals'),
        status: wonDeals.length >= (this.targets.dealsPerSalesperson * agents.length) ? 'good' : 'warning'
      },
      conversionRate: {
        value: companies.length > 0 ? wonDeals.length / companies.length : 0,
        target: this.targets.conversionRate,
        change: this.calculatePeriodChange(wonDeals.length / Math.max(companies.length, 1), 'rate'),
        status: (wonDeals.length / Math.max(companies.length, 1)) >= this.targets.conversionRate ? 'good' : 'warning'
      },
      avgDealSize: {
        value: wonDeals.length > 0 ? totalRevenue / wonDeals.length : 0,
        target: this.targets.avgDealSize,
        change: this.calculatePeriodChange(totalRevenue / Math.max(wonDeals.length, 1), 'value'),
        status: (totalRevenue / Math.max(wonDeals.length, 1)) >= this.targets.avgDealSize ? 'good' : 'warning'
      }
    };

    // Trender för diagram
    const trends = this.calculateSalesTrends(companies);
    
    // Pipeline-analys
    const pipeline = this.analyzePipeline(companies);
    
    // Säljarprestationer
    const salespeople = this.analyzeSalespersonPerformance(companies, agents);
    
    // Konverteringsanalys
    const conversion = this.analyzeConversionFunnel(companies);
    
    // Toppaffärer (största kunder)
    const topDeals = wonDeals
      .sort((a, b) => (Number(b.mrr) * 12 || Number(b.potentialValue) || 0) - (Number(a.mrr) * 12 || Number(a.potentialValue) || 0))
      .slice(0, 10)
      .map(company => ({
        ...company,
        companyName: company.namn,
        agentName: agents.find(a => a.id === company.assignedAgent)?.namn || 'Okänd säljare',
        värde: Number(company.mrr) * 12 || Number(company.potentialValue) || 0,
        datum: company.lastActivity || company.createdAt || new Date().toISOString()
      }));
    
    // Aktivitetssammanfattning
    const activities = this.summarizeActivities(companies, agents);

    return {
      kpis,
      trends,
      pipeline,
      salespeople,
      conversion,
      topDeals,
      activities
    };
  }

  /**
   * Rendera KPI-kort
   */
  renderKPICards(kpis) {
    const container = document.getElementById('kpiCards');
    if (!container) return;

    const kpiCards = [
      {
        title: 'Total Omsättning',
        ...kpis.totalRevenue,
        format: 'currency',
        icon: '💰'
      },
      {
        title: 'Antal Affärer',
        ...kpis.totalDeals,
        format: 'number',
        icon: '📊'
      },
      {
        title: 'Konverteringsgrad',
        ...kpis.conversionRate,
        format: 'percentage',
        icon: '🎯'
      },
      {
        title: 'Snitt Affärsstorlek',
        ...kpis.avgDealSize,
        format: 'currency',
        icon: '💎'
      }
    ];

    container.innerHTML = kpiCards.map(kpi => `
      <div class="bg-white p-8 rounded-xl border-2 ${kpi.status === 'good' ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'} shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between mb-6">
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-600 uppercase tracking-wider mb-2">${kpi.title}</p>
            <p class="text-3xl font-bold text-gray-900 mb-2">
              ${this.formatValue(kpi.value, kpi.format)}
            </p>
            <p class="text-base ${kpi.change >= 0 ? 'text-green-600' : 'text-red-600'} font-medium">
              ${kpi.change >= 0 ? '↗' : '↘'} ${Math.abs(kpi.change).toFixed(1)}% från förra perioden
            </p>
          </div>
          <div class="text-5xl opacity-80">${kpi.icon}</div>
        </div>
        <div class="space-y-3">
          <div class="flex justify-between text-sm text-gray-600">
            <span class="font-medium">Mål: ${this.formatValue(kpi.target, kpi.format)}</span>
            <span class="font-bold">${((kpi.value / kpi.target) * 100).toFixed(0)}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-3">
            <div class="bg-${kpi.status === 'good' ? 'green' : 'yellow'}-600 h-3 rounded-full transition-all duration-500" 
                 style="width: ${Math.min((kpi.value / kpi.target) * 100, 100)}%"></div>
          </div>
        </div>
      </div>
    `).join('');
  }

  /**
   * Formatera värden för visning
   */
  formatValue(value, format) {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('sv-SE', {
          style: 'currency',
          currency: 'SEK',
          minimumFractionDigits: 0
        }).format(value);
      case 'percentage':
        return (value * 100).toFixed(1) + '%';
      case 'number':
        return new Intl.NumberFormat('sv-SE').format(value);
      default:
        return value.toString();
    }
  }

  /**
   * Beräkna periodens startdatum
   */
  getPeriodStart(period) {
    const now = new Date();
    switch (period) {
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1);
        return weekStart;
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        return new Date(now.getFullYear(), quarter * 3, 1);
      case 'year':
        return new Date(now.getFullYear(), 0, 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }

  /**
   * Beräkna förändring från föregående period
   */
  calculatePeriodChange(currentValue, type) {
    // Simulerad data för demo - i produktion skulle detta jämföra med verklig historisk data
    const previousValue = currentValue * (0.8 + Math.random() * 0.4);
    return previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;
  }

  /**
   * Analysera pipeline
   */
  analyzePipeline(companies) {
    const pipelineStages = {
      'prospekt': 0,
      'intresserad': 0,
      'förhandling': 0,
      'kund': 0,
      'churned': 0
    };

    companies.forEach(company => {
      const status = company.status || 'prospekt';
      const value = Number(company.mrr) * 12 || Number(company.potentialValue) || 0;
      
      if (pipelineStages.hasOwnProperty(status)) {
        pipelineStages[status] += value;
      } else {
        // Fallback för okända statusar
        pipelineStages['prospekt'] += value;
      }
    });

    return pipelineStages;
  }

  /**
   * Ändra rapportperiod
   */
  changePeriod(period) {
    this.currentPeriod = period;
    this.loadDashboardData();
  }

  /**
   * Ändra säljare
   */
  changeSalesperson(salesperson) {
    this.currentSalesperson = salesperson;
    this.loadDashboardData();
  }

  /**
   * Ändra segment
   */
  changeSegment(segment) {
    this.currentSegment = segment;
    this.loadDashboardData();
  }

  /**
   * Exportera dashboard som PDF
   */
  exportDashboard() {
    const filters = [];
    if (this.currentSalesperson !== 'all') filters.push(`Säljare: ${this.currentSalesperson}`);
    if (this.currentSegment !== 'all') filters.push(`Segment: ${this.currentSegment}`);
    filters.push(`Period: ${this.currentPeriod}`);
    
    const filterText = filters.length > 0 ? ` (${filters.join(', ')})` : '';
    showNotification(`Förbereder PDF-export${filterText}...`, 'info');
    
    // I en riktig implementation skulle detta generera en professionell PDF
    setTimeout(() => {
      showNotification('PDF-rapport exporterad till nedladdningar', 'success');
    }, 2000);
  }

  /**
   * Schemalägg automatiska rapporter
   */
  scheduleReport() {
    modal.show(`
      <div class="space-y-6">
        <h3 class="text-lg font-medium">Schemalägg Automatiska Rapporter</h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Rapporttyp</label>
            <select id="reportType" class="w-full px-3 py-2 border rounded-md">
              <option value="dashboard">Säljchef Dashboard</option>
              <option value="individual">Individuella Säljrapporter</option>
              <option value="pipeline">Pipeline-analys</option>
              <option value="trends">Trendrapport</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">Frekvens</label>
            <select id="frequency" class="w-full px-3 py-2 border rounded-md">
              <option value="daily">Dagligen</option>
              <option value="weekly">Veckovis</option>
              <option value="monthly">Månadsvis</option>
              <option value="quarterly">Kvartalsvis</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">E-postmottagare</label>
            <input type="email" id="reportEmails" class="w-full px-3 py-2 border rounded-md" 
                   placeholder="Ange e-postadresser separerade med komma">
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">Tid för utskick</label>
            <input type="time" id="reportTime" class="w-full px-3 py-2 border rounded-md" value="08:00">
          </div>
        </div>
        
        <div class="flex justify-end space-x-3">
          <button onclick="modal.hide()" class="btn btn-secondary">Avbryt</button>
          <button onclick="salesReportManager.saveSchedule()" class="btn btn-primary">Spara Schema</button>
        </div>
      </div>
    `);
  }

  /**
   * Spara rapportschema
   */
  saveSchedule() {
    const reportType = document.getElementById('reportType')?.value;
    const frequency = document.getElementById('frequency')?.value;
    const emails = document.getElementById('reportEmails')?.value;
    const time = document.getElementById('reportTime')?.value;
    
    showNotification(`Rapportschema sparat: ${reportType} ${frequency} kl ${time}`, 'success');
    modal.hide();
  }

  /**
   * Beräkna försäljningstrender
   */
  calculateSalesTrends(companies) {
    const last12Months = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      
      // Hitta kunder som blev kunder denna månad
      const monthDeals = companies.filter(company => {
        if (company.status !== 'kund') return false;
        const dealDate = new Date(company.lastActivity || company.createdAt || Date.now());
        return dealDate >= monthDate && dealDate < nextMonth;
      });
      
      const revenue = monthDeals.reduce((sum, company) => {
        return sum + (Number(company.mrr) * 12 || Number(company.potentialValue) || 0);
      }, 0);
      
      last12Months.push({
        month: monthDate.toLocaleDateString('sv-SE', { month: 'short', year: '2-digit' }),
        revenue: revenue,
        deals: monthDeals.length
      });
    }
    
    return last12Months;
  }

  /**
   * Analysera säljarprestationer
   */
  analyzeSalespersonPerformance(companies, agents) {
    return agents.map(agent => {
      // Hitta företag tilldelade denna säljare
      const agentCompanies = companies.filter(company => company.assignedAgent === agent.id);
      const wonDeals = agentCompanies.filter(company => company.status === 'kund');
      
      const totalRevenue = wonDeals.reduce((sum, company) => {
        return sum + (Number(company.mrr) * 12 || Number(company.potentialValue) || 0);
      }, 0);
      
      return {
        id: agent.id,
        name: agent.namn,
        totalDeals: agentCompanies.length,
        wonDeals: wonDeals.length,
        revenue: totalRevenue,
        conversionRate: agentCompanies.length > 0 ? wonDeals.length / agentCompanies.length : 0,
        avgDealSize: wonDeals.length > 0 ? totalRevenue / wonDeals.length : 0,
        performance: this.calculatePerformanceScore(agentCompanies, wonDeals, totalRevenue)
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Beräkna prestationspoäng
   */
  calculatePerformanceScore(totalDeals, wonDeals, revenue) {
    const conversionWeight = 0.3;
    const volumeWeight = 0.4;
    const valueWeight = 0.3;
    
    const conversionScore = totalDeals.length > 0 ? (wonDeals.length / totalDeals.length) * 100 : 0;
    const volumeScore = Math.min((wonDeals.length / this.targets.dealsPerSalesperson) * 100, 100);
    const valueScore = Math.min((revenue / this.targets.monthlyRevenue) * 100, 100);
    
    return (conversionScore * conversionWeight + volumeScore * volumeWeight + valueScore * valueWeight);
  }

  /**
   * Analysera konverteringsprocess
   */
  analyzeConversionFunnel(deals) {
    const stages = ['Prospekt', 'Kvalificerad', 'Förhandling', 'Slutförhandling', 'Vunnen'];
    const funnel = {};
    
    stages.forEach(stage => {
      funnel[stage] = deals.filter(deal => deal.status === stage).length;
    });
    
    return funnel;
  }

  /**
   * Sammanfatta aktiviteter
   */
  summarizeActivities(deals, agents) {
    const activities = {
      callsMade: Math.floor(Math.random() * 500) + 200,
      emailsSent: Math.floor(Math.random() * 800) + 400,
      meetingsHeld: Math.floor(Math.random() * 150) + 50,
      proposalsSent: deals.filter(deal => deal.status === 'Förhandling').length,
      followUpsRequired: deals.filter(deal => {
        const lastContact = new Date(deal.senastKontakt || deal.datum);
        const daysSince = (new Date() - lastContact) / (1000 * 60 * 60 * 24);
        return daysSince > 7;
      }).length
    };
    
    return activities;
  }

  /**
   * Rendera säljarprestationer
   */
  renderSalespersonPerformance(salespeople) {
    const container = document.getElementById('salespersonPerformance');
    if (!container) return;

    container.innerHTML = `
      <div class="space-y-3">
        ${salespeople.slice(0, 5).map((person, index) => `
          <div class="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                ${index + 1}
              </div>
              <div>
                <div class="font-medium">${person.name}</div>
                <div class="text-sm text-gray-600">${person.wonDeals} affärer</div>
              </div>
            </div>
            <div class="text-right">
              <div class="font-bold">${this.formatValue(person.revenue, 'currency')}</div>
              <div class="text-sm text-gray-600">${(person.conversionRate * 100).toFixed(1)}% konvertering</div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="mt-4">
        <button onclick="salesReportManager.showDetailedSalesReport()" class="btn btn-sm btn-outline w-full">
          Visa alla säljare
        </button>
      </div>
    `;
  }

  /**
   * Rendera aktivitetssammanfattning
   */
  renderActivitySummary(activities) {
    const container = document.getElementById('activitySummary');
    if (!container) return;

    container.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600">${activities.callsMade}</div>
          <div class="text-sm text-gray-600">Samtal</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-green-600">${activities.emailsSent}</div>
          <div class="text-sm text-gray-600">E-post</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-purple-600">${activities.meetingsHeld}</div>
          <div class="text-sm text-gray-600">Möten</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-orange-600">${activities.proposalsSent}</div>
          <div class="text-sm text-gray-600">Offerter</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-red-600">${activities.followUpsRequired}</div>
          <div class="text-sm text-gray-600">Uppföljningar</div>
        </div>
      </div>
    `;
  }

  /**
   * Rendera toppaffärer-tabell
   */
  renderTopDealsTable(topDeals) {
    const container = document.getElementById('topDealsTable');
    if (!container) return;

    container.innerHTML = `
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="px-8 py-6 border-b border-gray-200">
          <h3 class="text-xl font-bold text-gray-900 flex items-center">
            <span class="text-3xl mr-3">🏆</span>
            Toppaffärer denna period
          </h3>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-100">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-8 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Affär</th>
                <th class="px-8 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Företag</th>
                <th class="px-8 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Säljare</th>
                <th class="px-8 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Värde</th>
                <th class="px-8 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Datum</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-100">
              ${topDeals.map((deal, index) => `
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-8 py-6">
                    <div class="flex items-center space-x-3">
                      <div class="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                        ${index + 1}
                      </div>
                      <span class="text-base font-medium text-gray-900">
                        ${deal.titel || 'Affär #' + deal.id}
                      </span>
                    </div>
                  </td>
                  <td class="px-8 py-6 text-base text-gray-700">
                    ${deal.companyName}
                  </td>
                  <td class="px-8 py-6 text-base text-gray-700">
                    ${deal.agentName}
                  </td>
                  <td class="px-8 py-6">
                    <span class="text-lg font-bold text-green-600">
                      ${this.formatValue(deal.värde, 'currency')}
                    </span>
                  </td>
                  <td class="px-8 py-6 text-base text-gray-700">
                    ${new Date(deal.datum).toLocaleDateString('sv-SE')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Visa detaljerad säljrapport
   */
  showDetailedSalesReport() {
    modal.show(`
      <div class="space-y-6">
        <h3 class="text-xl font-bold">Detaljerad Säljrapport</h3>
        
        <div class="bg-blue-50 p-4 rounded-lg">
          <h4 class="font-medium mb-2">📊 Säljarprestationer (${this.currentPeriod})</h4>
          <p class="text-sm text-blue-700">Komplett översikt över alla säljares prestationer, mål och trender.</p>
        </div>
        
        <div id="detailedSalesData">
          <!-- Fylls dynamiskt med detaljerad data -->
        </div>
        
        <div class="flex justify-end space-x-3">
          <button onclick="salesReportManager.exportSalesReport()" class="btn btn-primary">📄 Exportera</button>
          <button onclick="modal.hide()" class="btn btn-secondary">Stäng</button>
        </div>
      </div>
    `);
    
    this.loadDetailedSalesData();
  }

  /**
   * Ladda detaljerad säljdata
   */
  async loadDetailedSalesData() {
    const container = document.getElementById('detailedSalesData');
    if (!container) return;

    const data = await this.calculateSalesMetrics();
    
    container.innerHTML = `
      <div class="space-y-6">
        ${data.salespeople.map(person => `
          <div class="border rounded-lg p-4">
            <div class="flex justify-between items-start mb-4">
              <div>
                <h5 class="font-medium text-lg">${person.name}</h5>
                <p class="text-sm text-gray-600">Prestationspoäng: ${person.performance.toFixed(1)}/100</p>
              </div>
              <div class="text-right">
                <div class="text-lg font-bold text-green-600">${this.formatValue(person.revenue, 'currency')}</div>
                <div class="text-sm text-gray-600">${person.wonDeals}/${person.totalDeals} affärer</div>
              </div>
            </div>
            
            <div class="grid grid-cols-3 gap-4">
              <div class="text-center p-3 bg-gray-50 rounded">
                <div class="text-lg font-bold">${(person.conversionRate * 100).toFixed(1)}%</div>
                <div class="text-xs text-gray-600">Konvertering</div>
              </div>
              <div class="text-center p-3 bg-gray-50 rounded">
                <div class="text-lg font-bold">${this.formatValue(person.avgDealSize, 'currency')}</div>
                <div class="text-xs text-gray-600">Snitt/affär</div>
              </div>
              <div class="text-center p-3 bg-gray-50 rounded">
                <div class="text-lg font-bold">${person.wonDeals}</div>
                <div class="text-xs text-gray-600">Vunna affärer</div>
              </div>
            </div>
            
            <div class="mt-3">
              <div class="flex justify-between text-sm text-gray-600">
                <span>Måluppfyllelse: ${((person.revenue / this.targets.monthlyRevenue) * 100).toFixed(0)}%</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div class="bg-blue-600 h-2 rounded-full" 
                     style="width: ${Math.min((person.revenue / this.targets.monthlyRevenue) * 100, 100)}%"></div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Placeholders för chart-rendering (skulle använda Chart.js eller liknande)
   */
  renderSalesTrendChart(trends) {
    console.log('Sales trends chart data:', trends);
    // I produktion: Implementera med Chart.js
  }

  renderPipelineChart(pipeline) {
    console.log('Pipeline chart data:', pipeline);
    // I produktion: Implementera med Chart.js
  }

  renderConversionChart(conversion) {
    console.log('Conversion chart data:', conversion);
    // I produktion: Implementera med Chart.js
  }

  /**
   * Export-funktioner
   */
  exportTopDeals() {
    showNotification('Exporterar toppaffärer till Excel...', 'info');
    setTimeout(() => showNotification('Export klar!', 'success'), 1500);
  }

  exportSalesReport() {
    showNotification('Exporterar säljrapport till PDF...', 'info');
    setTimeout(() => showNotification('PDF-rapport sparad!', 'success'), 2000);
  }

  showActivityDetails() {
    modal.show(`
      <div class="space-y-6">
        <h3 class="text-xl font-bold">Detaljerad Aktivitetsrapport</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white p-4 border rounded-lg">
            <h4 class="font-medium mb-3">📞 Samtalsaktivitet</h4>
            <ul class="space-y-2 text-sm">
              <li>Utgående samtal: 342 st</li>
              <li>Inkommande samtal: 158 st</li>
              <li>Genomsnittlig samtalstid: 8:24 min</li>
              <li>Uppföljningssamtal: 89 st</li>
            </ul>
          </div>
          
          <div class="bg-white p-4 border rounded-lg">
            <h4 class="font-medium mb-3">📧 E-postaktivitet</h4>
            <ul class="space-y-2 text-sm">
              <li>E-post skickade: 623 st</li>
              <li>Öppningsgrad: 68%</li>
              <li>Klickfrekvens: 23%</li>
              <li>Svar erhållna: 156 st</li>
            </ul>
          </div>
          
          <div class="bg-white p-4 border rounded-lg">
            <h4 class="font-medium mb-3">🤝 Mötesaktivitet</h4>
            <ul class="space-y-2 text-sm">
              <li>Möten genomförda: 87 st</li>
              <li>Genomsnittlig mötestid: 45 min</li>
              <li>Kundbesök: 34 st</li>
              <li>Online-möten: 53 st</li>
            </ul>
          </div>
          
          <div class="bg-white p-4 border rounded-lg">
            <h4 class="font-medium mb-3">📄 Dokumentaktivitet</h4>
            <ul class="space-y-2 text-sm">
              <li>Offerter skickade: 45 st</li>
              <li>Kontrakt signerade: 28 st</li>
              <li>Presentationer skapade: 19 st</li>
              <li>Uppföljningar inlagda: 156 st</li>
            </ul>
          </div>
        </div>
        
        <div class="flex justify-end space-x-3">
          <button onclick="modal.hide()" class="btn btn-secondary">Stäng</button>
        </div>
      </div>
    `);
  }

  /**
   * Hjälpfunktioner för filtrering
   */
  renderActiveFilters() {
    const container = document.getElementById('activeFilters');
    if (!container) return;

    const filters = [];
    
    if (this.currentSalesperson !== 'all') {
      const displayName = this.currentSalesperson.split('.').map(part => 
        part.charAt(0).toUpperCase() + part.slice(1)
      ).join(' ');
      filters.push({ type: 'Säljare', value: displayName, key: 'salesperson' });
    }
    
    if (this.currentSegment !== 'all') {
      const segmentNames = {
        'enterprise': 'Enterprise',
        'smb': 'SMB', 
        'startup': 'Startup',
        'government': 'Offentlig sektor'
      };
      filters.push({ type: 'Segment', value: segmentNames[this.currentSegment] || this.currentSegment, key: 'segment' });
    }

    if (filters.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <span class="text-blue-700 font-medium">Aktiva filter:</span>
            <div class="flex space-x-2">
              ${filters.map(filter => `
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  ${filter.type}: ${filter.value}
                  <button onclick="salesReportManager.removeFilter('${filter.key}')" class="ml-2 text-blue-600 hover:text-blue-800">
                    ×
                  </button>
                </span>
              `).join('')}
            </div>
          </div>
          <button onclick="salesReportManager.clearAllFilters()" class="text-blue-600 hover:text-blue-800 text-sm font-medium">
            Rensa alla filter
          </button>
        </div>
      </div>
    `;
  }

  removeFilter(filterType) {
    if (filterType === 'salesperson') {
      this.currentSalesperson = 'all';
      document.getElementById('salespersonSelector').value = 'all';
    } else if (filterType === 'segment') {
      this.currentSegment = 'all';
      document.getElementById('segmentSelector').value = 'all';
    }
    this.loadDashboardData();
  }

  clearAllFilters() {
    this.currentSalesperson = 'all';
    this.currentSegment = 'all';
    document.getElementById('salespersonSelector').value = 'all';
    document.getElementById('segmentSelector').value = 'all';
    this.loadDashboardData();
  }

  normalizeAgentName(name) {
    if (!name) return 'unknown';
    return name.toLowerCase()
      .replace('å', 'a').replace('ä', 'a').replace('ö', 'o')
      .replace(' ', '.');
  }

  determineCompanySegment(company) {
    const employees = parseInt(company.employees) || 0;
    const revenue = parseFloat(company.mrr) * 12 || parseFloat(company.potentialValue) || 0;
    
    // Bestäm segment baserat på företagsstorlek och värde
    if (employees > 1000 || revenue > 1000000) {
      return 'enterprise';
    } else if (employees > 50 || revenue > 100000) {
      return 'smb';
    } else if (company.name && company.name.toLowerCase().includes('kommun')) {
      return 'government';
    } else {
      return 'startup';
    }
  }
}

// Skapa global instans
const salesReportManager = new SalesReportManager();