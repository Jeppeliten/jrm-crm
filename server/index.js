/**
 * 🚀 Clean CRM Server - Azure Entra ID + Cosmos DB
 * Minimal server för testning av ren arkitektur
 */

// Application Insights måste initialiseras först
if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY || process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  const appInsights = require('applicationinsights');
  appInsights.setup()
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true)
    .setUseDiskRetryCaching(true)
    .setSendLiveMetrics(true)
    .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C);
  appInsights.start();
  console.log('✅ Application Insights initialized');
}

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Services (endast om Cosmos DB är konfigurerat)
let cosmosService = null;
let userService = null;

try {
  if (process.env.COSMOS_DB_CONNECTION_STRING) {
    const { getCosmosService } = require('./services/cosmos-service');
    const UserService = require('./services/user-service');
    cosmosService = getCosmosService();
    userService = new UserService();
  }
} catch (error) {
  console.log('ℹ️ Cosmos DB services not loaded (configuration missing)');
}

// Azure B2C Auth middleware (endast om konfigurerat)
let azureAuth = null;
try {
  if (process.env.AZURE_B2C_TENANT_NAME) {
    azureAuth = require('./auth-azure-b2c-middleware');
  }
} catch (error) {
  console.log('ℹ️ Azure B2C middleware not loaded (configuration missing)');
}

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE SETUP
// ============================================

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://alcdn.msauth.net"],
      connectSrc: ["'self'", "https://*.b2clogin.com", "https://graph.microsoft.com"]
    }
  }
}));

// CORS
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5000',
    'https://localhost:3000',
    ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [])
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
});
app.use('/api', limiter);

// Body parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// HEALTH CHECK ENDPOINTS
// ============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0-clean',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', (req, res) => {
  const health = {
    server: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      cosmosDb: cosmosService ? 'configured' : 'not_configured',
      azureAuth: azureAuth ? 'configured' : 'not_configured'
    }
  };
  
  res.json(health);
});

app.get('/api/health/cosmos', async (req, res) => {
  if (!cosmosService) {
    return res.status(503).json({
      status: 'not_configured',
      message: 'Cosmos DB connection string not provided'
    });
  }

  try {
    const healthCheck = await cosmosService.healthCheck();
    res.json(healthCheck);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// AZURE AUTH CONFIG ENDPOINT
// ============================================

app.get('/api/auth/config', (req, res) => {
  if (!azureAuth) {
    return res.json({
      configured: false,
      message: 'Azure B2C not configured'
    });
  }

  res.json({
    configured: true,
    tenantName: process.env.AZURE_B2C_TENANT_NAME,
    clientId: process.env.AZURE_B2C_CLIENT_ID,
    policyName: process.env.AZURE_B2C_POLICY_NAME
  });
});

// ============================================
// BASIC API ENDPOINTS
// ============================================

// Test endpoint (no auth required)
app.get('/api/test', (req, res) => {
  res.json({
    message: 'CRM API is working!',
    timestamp: new Date().toISOString(),
    version: '2.0.0-clean'
  });
});

// Users endpoint (with optional auth)
app.get('/api/users', async (req, res) => {
  try {
    if (!userService) {
      return res.status(503).json({
        error: 'User service not available (Cosmos DB not configured)'
      });
    }

    // Optional auth check
    if (azureAuth && req.headers.authorization) {
      // Validate token if provided
      const authResult = await azureAuth.validateToken(req.headers.authorization);
      if (!authResult.valid) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      req.user = authResult.user;
    }

    const filters = {
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      skip: req.query.skip ? parseInt(req.query.skip) : 0,
      search: req.query.search,
      role: req.query.role,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined
    };

    const users = await userService.listUsers(filters);
    const total = await userService.countUsers(filters);

    res.json({
      users,
      total,
      page: Math.floor(filters.skip / filters.limit) + 1,
      pageSize: filters.limit
    });

  } catch (error) {
    console.error('Users endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      message: error.message
    });
  }
});

// Companies endpoint removed - handled by routes/companies.js

// ============================================
// DATABASE MIDDLEWARE
// ============================================

// Add database middleware for all data routes
const dbMiddleware = (req, res, next) => {
  // Set database if available, but DON'T block if unavailable
  if (cosmosService && cosmosService.db) {
    req.app.locals.db = cosmosService.db;
    req.db = cosmosService.db;
    console.log('✓ Database middleware: DB available');
  } else {
    console.log('⚠️  Database middleware: DB not available, routes will use mock data');
  }
  next(); // Always continue to routes
};

// ============================================
// API ROUTES
// ============================================

const importRouter = require('./routes/import');
const brandsRouter = require('./routes/brands');
const companiesRouter = require('./routes/companies');
const agentsRouter = require('./routes/agents');
const dealsRouter = require('./routes/deals');
const tasksRouter = require('./routes/tasks');
const adminRouter = require('./routes/admin');

app.use('/api/import', dbMiddleware, importRouter);
app.use('/api/brands', dbMiddleware, brandsRouter);
app.use('/api/companies', dbMiddleware, companiesRouter);
app.use('/api/agents', dbMiddleware, agentsRouter);
app.use('/api/deals', dbMiddleware, dealsRouter);
app.use('/api/tasks', dbMiddleware, tasksRouter);
app.use('/api/admin', dbMiddleware, adminRouter);

// ============================================
// ERROR HANDLING MIDDLEWARE (must be AFTER routes)
// ============================================

app.use((err, req, res, next) => {
  console.error('❌ Error caught by error handler:', err);
  console.error('❌ Error code:', err.code);
  console.error('❌ Error stack:', err.stack);
  
  // Handle MongoDB duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({
      error: 'E11000 duplicate key error collection: jrm-crm-db.companies. Failed _id or unique index constraint.',
      message: 'A record with this information already exists. Please use different values.'
    });
  }
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    message: 'Something went wrong',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ============================================
// STATIC FILE SERVING
// ============================================

const FRONTEND_DIR = path.join(__dirname, '..', 'client');
app.use(express.static(FRONTEND_DIR));

// Serve index.html for SPA routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// ============================================
// SERVER STARTUP
// ============================================

async function startServer() {
  try {
    // Initialize Cosmos DB if configured
    if (cosmosService) {
      console.log('🔌 Connecting to Cosmos DB...');
      await cosmosService.connect();
      console.log('✅ Cosmos DB connected successfully');
    } else {
      console.log('ℹ️ Cosmos DB not configured - running in test mode');
    }

    // Start server
    app.listen(PORT, () => {
      console.log('\n🚀 CRM Server Started Successfully!');
      console.log('═══════════════════════════════════════');
      console.log(`📍 Server running on: http://localhost:${PORT}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log(`🔧 API status: http://localhost:${PORT}/api/health`);
      console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
      console.log('═══════════════════════════════════════');
      
      if (!cosmosService) {
        console.log('⚠️  Warning: Cosmos DB not configured');
        console.log('   Create .env file with COSMOS_DB_CONNECTION_STRING');
      }
      
      if (!azureAuth) {
        console.log('ℹ️  Info: Azure B2C not configured');
        console.log('   Add Azure B2C settings to .env for full functionality');
      }
      
      console.log('\n✅ Ready for testing!\n');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  if (cosmosService) {
    await cosmosService.disconnect();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down server...');
  if (cosmosService) {
    await cosmosService.disconnect();
  }
  process.exit(0);
});

// Start the server
startServer();