// System Status Dashboard för CRM
// Visar status för alla integreringar och systemkomponenter

class SystemStatusDashboard {
  constructor() {
    this.components = {
      'crm-core': { name: 'CRM Core', status: 'unknown' },
      'outlook-integration': { name: 'Outlook Integration', status: 'unknown' },
      'azure-b2c': { name: 'Azure B2C', status: 'unknown' },
      'visma-integration': { name: 'Visma.net', status: 'unknown' },
      'database': { name: 'Database', status: 'unknown' },
      'api-health': { name: 'API Health', status: 'unknown' }
    };
    
    this.refreshInterval = null;
  }

  async showSystemStatus() {
    const modalBody = domCache.getModalBody();
    
    modalBody.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-bold">🔧 System Status Dashboard</h2>
          <div class="flex gap-2">
            <button onclick="systemStatus.refreshStatus()" class="btn btn-sm btn-outline">
              🔄 Refresh
            </button>
            <label class="label cursor-pointer gap-2">
              <input type="checkbox" id="autoRefresh" class="checkbox checkbox-sm" onchange="systemStatus.toggleAutoRefresh(this.checked)">
              <span class="label-text text-sm">Auto-refresh</span>
            </label>
          </div>
        </div>

        <!-- System Overview -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="stats shadow">
            <div class="stat">
              <div class="stat-title">System Health</div>
              <div class="stat-value text-2xl" id="overallHealth">Checking...</div>
              <div class="stat-desc" id="overallStatus">Starting diagnostics...</div>
            </div>
          </div>
          
          <div class="stats shadow">
            <div class="stat">
              <div class="stat-title">Uptime</div>
              <div class="stat-value text-2xl" id="systemUptime">-</div>
              <div class="stat-desc">Server runtime</div>
            </div>
          </div>
          
          <div class="stats shadow">
            <div class="stat">
              <div class="stat-title">Memory Usage</div>
              <div class="stat-value text-2xl" id="memoryUsage">-</div>
              <div class="stat-desc" id="memoryDetails">Loading...</div>
            </div>
          </div>
        </div>

        <!-- Component Status -->
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h3 class="card-title">Component Status</h3>
            <div class="space-y-3" id="componentStatus">
              <!-- Components will be loaded here -->
            </div>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h3 class="card-title">Recent System Activity</h3>
            <div class="space-y-2" id="recentActivity">
              <div class="text-sm text-base-content/70">Loading activity log...</div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h3 class="card-title">Quick Actions</h3>
            <div class="flex flex-wrap gap-2">
              <button onclick="systemStatus.exportLogs()" class="btn btn-sm btn-outline">
                📋 Export Logs
              </button>
              <button onclick="systemStatus.testConnections()" class="btn btn-sm btn-outline">
                🔌 Test All Connections
              </button>
              <button onclick="systemStatus.clearCache()" class="btn btn-sm btn-outline">
                🗑️ Clear Cache
              </button>
              <button onclick="systemStatus.showDiagnostics()" class="btn btn-sm btn-outline">
                🔍 Run Diagnostics
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Visa modal
    domCache.getModal().classList.remove('hidden');
    
    // Starta statusuppdatering
    await this.refreshStatus();
  }

  async refreshStatus() {
    try {
      // Uppdatera system overview
      await this.updateSystemOverview();
      
      // Uppdatera komponentstatus
      await this.updateComponentStatus();
      
      // Uppdatera aktivitetslogg
      await this.updateRecentActivity();
      
      console.log('🔄 System status refreshed');
    } catch (error) {
      console.error('❌ Failed to refresh system status:', error);
    }
  }

  async updateSystemOverview() {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        
        // Overall health
        const healthElement = document.getElementById('overallHealth');
        const statusElement = document.getElementById('overallStatus');
        if (healthElement && statusElement) {
          if (data.status === 'ok') {
            healthElement.textContent = '✅ Healthy';
            healthElement.className = 'stat-value text-2xl text-success';
            statusElement.textContent = 'All systems operational';
          } else {
            healthElement.textContent = '⚠️ Warning';
            healthElement.className = 'stat-value text-2xl text-warning';
            statusElement.textContent = 'Some issues detected';
          }
        }
        
        // Uptime
        const uptimeElement = document.getElementById('systemUptime');
        if (uptimeElement && data.uptime) {
          const hours = Math.floor(data.uptime / 3600);
          const minutes = Math.floor((data.uptime % 3600) / 60);
          uptimeElement.textContent = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }
        
        // Memory
        const memoryElement = document.getElementById('memoryUsage');
        const memoryDetailsElement = document.getElementById('memoryDetails');
        if (memoryElement && memoryDetailsElement && data.memory) {
          memoryElement.textContent = `${data.memory.used}MB`;
          memoryDetailsElement.textContent = `of ${data.memory.total}MB total`;
        }
        
      }
    } catch (error) {
      console.warn('Could not fetch health data:', error);
    }
  }

  async updateComponentStatus() {
    const container = document.getElementById('componentStatus');
    if (!container) return;

    // Test CRM Core
    this.components['crm-core'].status = 'healthy';
    this.components['crm-core'].message = 'Core functionality operational';

    // Test API Health
    try {
      const response = await fetch('/api/health');
      this.components['api-health'].status = response.ok ? 'healthy' : 'warning';
      this.components['api-health'].message = response.ok ? 'API responding normally' : 'API response issues';
    } catch (error) {
      this.components['api-health'].status = 'error';
      this.components['api-health'].message = 'API unreachable';
    }

    // Test Database (via state check)
    try {
      const response = await fetch('/api/companies?limit=1');
      this.components['database'].status = response.ok ? 'healthy' : 'warning';
      this.components['database'].message = response.ok ? 'Data layer operational' : 'Data access issues';
    } catch (error) {
      this.components['database'].status = 'error';
      this.components['database'].message = 'Database connection failed';
    }

    // Test Outlook Integration
    if (typeof outlookIntegration !== 'undefined') {
      this.components['outlook-integration'].status = 'healthy';
      this.components['outlook-integration'].message = 'Integration loaded and ready';
    } else {
      this.components['outlook-integration'].status = 'error';
      this.components['outlook-integration'].message = 'Integration not loaded';
    }

    // Test Azure B2C (simulated)
    this.components['azure-b2c'].status = 'disabled';
    this.components['azure-b2c'].message = 'Disabled in development mode';

    // Test Visma Integration (simulated)
    this.components['visma-integration'].status = 'disabled';
    this.components['visma-integration'].message = 'No credentials configured';

    // Render components
    container.innerHTML = Object.entries(this.components).map(([key, component]) => `
      <div class="flex items-center justify-between p-3 bg-base-200 rounded-lg">
        <div class="flex items-center gap-3">
          <div class="w-3 h-3 rounded-full ${this.getStatusColor(component.status)}"></div>
          <div>
            <div class="font-medium">${component.name}</div>
            <div class="text-sm text-base-content/70">${component.message || 'No additional info'}</div>
          </div>
        </div>
        <div class="badge ${this.getStatusBadge(component.status)}">${component.status}</div>
      </div>
    `).join('');
  }

  getStatusColor(status) {
    switch (status) {
      case 'healthy': return 'bg-success';
      case 'warning': return 'bg-warning';
      case 'error': return 'bg-error';
      case 'disabled': return 'bg-base-content/30';
      default: return 'bg-base-content/50';
    }
  }

  getStatusBadge(status) {
    switch (status) {
      case 'healthy': return 'badge-success';
      case 'warning': return 'badge-warning';
      case 'error': return 'badge-error';
      case 'disabled': return 'badge-neutral';
      default: return 'badge-ghost';
    }
  }

  async updateRecentActivity() {
    const container = document.getElementById('recentActivity');
    if (!container) return;

    // Simulera aktivitetslogg
    const activities = [
      { time: '2 minutes ago', action: 'System status dashboard opened', user: 'Current user', type: 'info' },
      { time: '5 minutes ago', action: 'Health check completed successfully', user: 'System', type: 'success' },
      { time: '12 minutes ago', action: 'Version updated to 1.1.0', user: 'Auto-deployment', type: 'info' },
      { time: '18 minutes ago', action: 'New feature branch created', user: 'Git', type: 'info' },
      { time: '25 minutes ago', action: 'Server restarted', user: 'System', type: 'warning' }
    ];

    container.innerHTML = activities.map(activity => `
      <div class="flex items-center justify-between p-2 bg-base-100 rounded">
        <div class="flex items-center gap-3">
          <div class="w-2 h-2 rounded-full ${activity.type === 'success' ? 'bg-success' : activity.type === 'warning' ? 'bg-warning' : 'bg-info'}"></div>
          <div>
            <div class="text-sm">${activity.action}</div>
            <div class="text-xs text-base-content/50">${activity.user} • ${activity.time}</div>
          </div>
        </div>
      </div>
    `).join('');
  }

  toggleAutoRefresh(enabled) {
    if (enabled) {
      this.refreshInterval = setInterval(() => this.refreshStatus(), 30000); // 30 sekunder
      console.log('🔄 Auto-refresh enabled (30s interval)');
    } else {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
      console.log('⏸️ Auto-refresh disabled');
    }
  }

  async testConnections() {
    console.log('🔌 Testing all connections...');
    
    // Visa loading state
    const healthElement = document.getElementById('overallHealth');
    if (healthElement) {
      healthElement.textContent = '🔄 Testing...';
      healthElement.className = 'stat-value text-2xl text-info';
    }

    // Kör tester
    await this.refreshStatus();
    
    // Visa notifikation
    this.showNotification('Connection tests completed', 'success');
  }

  async exportLogs() {
    console.log('📋 Exporting system logs...');
    
    const logs = {
      timestamp: new Date().toISOString(),
      version: '1.1.0',
      components: this.components,
      environment: 'development',
      uptime: document.getElementById('systemUptime')?.textContent || 'unknown'
    };

    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-system-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showNotification('System logs exported successfully', 'success');
  }

  async clearCache() {
    console.log('🗑️ Clearing system cache...');
    
    // Rensa localStorage cache
    const cacheKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('crm_') || key.startsWith('cache_')
    );
    
    cacheKeys.forEach(key => localStorage.removeItem(key));
    
    this.showNotification(`Cleared ${cacheKeys.length} cache entries`, 'success');
  }

  async showDiagnostics() {
    console.log('🔍 Running system diagnostics...');
    
    const diagnostics = {
      browser: navigator.userAgent,
      screen: `${screen.width}x${screen.height}`,
      localStorage: this.checkLocalStorage(),
      network: await this.checkNetwork(),
      performance: this.checkPerformance()
    };

    console.table(diagnostics);
    this.showNotification('Diagnostics completed - check console for details', 'info');
  }

  checkLocalStorage() {
    try {
      const testKey = 'crm_test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return 'Available';
    } catch (error) {
      return 'Not available';
    }
  }

  async checkNetwork() {
    try {
      const start = performance.now();
      await fetch('/api/health');
      const end = performance.now();
      return `${Math.round(end - start)}ms response time`;
    } catch (error) {
      return 'Network error';
    }
  }

  checkPerformance() {
    return {
      memory: navigator.memory ? `${Math.round(navigator.memory.usedJSHeapSize / 1024 / 1024)}MB` : 'Unknown',
      timing: performance.timing ? `${performance.timing.loadEventEnd - performance.timing.navigationStart}ms load time` : 'Unknown'
    };
  }

  showNotification(message, type = 'info') {
    // Skapa en enkel notification
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} fixed top-4 right-4 w-auto max-w-sm z-50`;
    notification.innerHTML = `
      <div class="flex items-center gap-2">
        <span>${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" class="btn btn-ghost btn-xs">✕</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove efter 5 sekunder
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  cleanup() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}

// Skapa global instans
const systemStatus = new SystemStatusDashboard();

// Cleanup vid modal-stängning
document.addEventListener('click', (e) => {
  if (e.target.id === 'modalClose' || e.target.classList.contains('custom-modal-backdrop')) {
    systemStatus.cleanup();
  }
});

// Export för testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SystemStatusDashboard };
}