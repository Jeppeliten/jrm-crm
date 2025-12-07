// ==========================================
// JRM CRM System - Azure Infrastructure
// ==========================================
// Skapar komplett Azure-miljö för CRM-systemet

// Parameters
@description('Miljö (dev, staging, prod)')
@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string = 'prod'

@description('Azure region')
param location string = resourceGroup().location

@description('Applikationsnamn (används som prefix)')
@minLength(3)
@maxLength(20)
param appName string = 'jrm-crm'

@description('Azure B2C Tenant Name')
param azureB2cTenantName string = 'varderingsdata'

@description('Azure B2C Client ID för backend')
@secure()
param azureB2cClientId string

@description('Cosmos DB throughput (400 = Free tier)')
@minValue(400)
@maxValue(10000)
param cosmosDbThroughput int = 400

// Variables
var uniqueSuffix = uniqueString(resourceGroup().id)
var appServicePlanName = '${appName}-plan-${environment}'
var webAppName = '${appName}-api-${environment}-${uniqueSuffix}'
var staticWebAppName = '${appName}-frontend-${environment}'
var cosmosDbAccountName = '${appName}-cosmos-${environment}-${uniqueSuffix}'
var appInsightsName = '${appName}-insights-${environment}'
var logAnalyticsName = '${appName}-logs-${environment}'

// Tags för alla resurser
var commonTags = {
  Environment: environment
  Application: appName
  ManagedBy: 'Bicep'
  CostCenter: 'IT'
}

// ==========================================
// Log Analytics Workspace
// ==========================================
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  tags: commonTags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

// ==========================================
// Application Insights
// ==========================================
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: commonTags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    RetentionInDays: 90
  }
}

// ==========================================
// Cosmos DB (MongoDB API)
// ==========================================
resource cosmosDbAccount 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' = {
  name: cosmosDbAccountName
  location: location
  tags: commonTags
  kind: 'MongoDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    enableFreeTier: environment == 'dev' ? true : false
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: [
      {
        name: 'EnableMongo'
      }
      {
        name: 'EnableServerless'
      }
    ]
    apiProperties: {
      serverVersion: '4.2'
    }
  }
}

resource cosmosDbDatabase 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases@2023-11-15' = {
  parent: cosmosDbAccount
  name: 'crm_database'
  properties: {
    resource: {
      id: 'crm_database'
    }
  }
}

// Collections
var collections = [
  'customers'
  'deals'
  'activities'
  'users'
  'audit_logs'
]

resource cosmosDbCollections 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2023-11-15' = [for collection in collections: {
  parent: cosmosDbDatabase
  name: collection
  properties: {
    resource: {
      id: collection
      shardKey: {
        _id: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: [
              '_id'
            ]
          }
        }
      ]
    }
  }
}]

// ==========================================
// App Service Plan
// ==========================================
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: appServicePlanName
  location: location
  tags: commonTags
  sku: {
    name: environment == 'prod' ? 'B1' : 'F1'
    tier: environment == 'prod' ? 'Basic' : 'Free'
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

// ==========================================
// Web App (Backend API)
// ==========================================
resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: webAppName
  location: location
  tags: commonTags
  kind: 'app,linux'
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|18-lts'
      alwaysOn: environment == 'prod'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/health'
      cors: {
        allowedOrigins: [
          'https://${staticWebApp.properties.defaultHostname}'
        ]
        supportCredentials: true
      }
      appSettings: [
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'PORT'
          value: '8080'
        }
        {
          name: 'COSMOS_DB_CONNECTION_STRING'
          value: cosmosDbAccount.listConnectionStrings().connectionStrings[0].connectionString
        }
        {
          name: 'COSMOS_DB_DATABASE_NAME'
          value: 'crm_database'
        }
        {
          name: 'AZURE_B2C_TENANT_NAME'
          value: azureB2cTenantName
        }
        {
          name: 'AZURE_B2C_TENANT_ID'
          value: '${azureB2cTenantName}.onmicrosoft.com'
        }
        {
          name: 'AZURE_B2C_CLIENT_ID'
          value: azureB2cClientId
        }
        {
          name: 'AZURE_B2C_POLICY_NAME'
          value: 'B2C_1_signup_signin'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~18'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
      ]
    }
  }
}

// ==========================================
// Static Web App (Frontend)
// ==========================================
resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: staticWebAppName
  location: 'westeurope' // Static Web Apps not available in Sweden Central yet
  tags: commonTags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: 'https://github.com/YOUR-USERNAME/JRM'
    branch: 'main'
    buildProperties: {
      appLocation: '/client'
      outputLocation: ''
    }
  }
}

// ==========================================
// Outputs
// ==========================================
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output cosmosDbEndpoint string = cosmosDbAccount.properties.documentEndpoint
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output resourceGroupName string = resourceGroup().name

output deploymentInstructions string = '''
===================================
🎉 DEPLOYMENT KLAR!
===================================

Backend API: https://${webApp.properties.defaultHostName}
Frontend: https://${staticWebApp.properties.defaultHostname}

NÄSTA STEG:

1. Uppdatera client/azure-b2c-config.js:
   - API_BASE_URL = 'https://${webApp.properties.defaultHostName}'
   - redirectUri = 'https://${staticWebApp.properties.defaultHostname}'

2. Uppdatera Azure B2C Redirect URIs:
   - Lägg till: https://${staticWebApp.properties.defaultHostname}

3. Deploya kod:
   Backend:  az webapp deployment source config-zip --resource-group ${resourceGroup().name} --name ${webAppName} --src deploy.zip
   Frontend: Koppla GitHub repo i Azure Portal

4. Testa:
   curl https://${webApp.properties.defaultHostName}/health

===================================
'''
