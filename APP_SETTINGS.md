# 🔧 Azure App Settings - Kopiera in dessa värden

## I Azure Portal → Configuration → Application Settings

Klicka på **"New application setting"** för varje rad nedan:

### 1. NODE_ENV
```
production
```

### 2. PORT
```
8080
```

### 3. COSMOS_DB_CONNECTION_STRING
```
mongodb://YOUR_COSMOS_ACCOUNT:YOUR_KEY@YOUR_COSMOS_ACCOUNT.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=@YOUR_COSMOS_ACCOUNT@
```
**Note:** Get actual value from Azure Portal → Cosmos DB → Connection String

### 4. COSMOS_DB_DATABASE_NAME
```
crm_database
```

### 5. AZURE_B2C_TENANT_NAME
```
varderingsdata
```

### 6. AZURE_B2C_TENANT_ID
```
varderingsdata.onmicrosoft.com
```

### 7. AZURE_B2C_CLIENT_ID
```
DIN-B2C-CLIENT-ID-HÄR
```
*(Hämta från Azure B2C Portal → App registrations)*

### 8. AZURE_B2C_POLICY_NAME
```
B2C_1_signup_signin
```

### 9. SCM_DO_BUILD_DURING_DEPLOYMENT
```
true
```

### 10. WEBSITE_NODE_DEFAULT_VERSION
```
~18
```

---

## Efter du lagt till alla settings:

1. Klicka **Save** längst upp
2. Klicka **Continue** när den frågar om restart
3. Vänta 30 sekunder
4. Testa: `curl https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net/health`

---

## Eller använd denna snabba PowerShell-metod:

```powershell
# Kopiera hela blocket och kör i PowerShell
$settings = @{
    "NODE_ENV" = "production"
    "PORT" = "8080"
    "COSMOS_DB_DATABASE_NAME" = "crm_database"
    "AZURE_B2C_TENANT_NAME" = "varderingsdata"
    "AZURE_B2C_TENANT_ID" = "varderingsdata.onmicrosoft.com"
    "AZURE_B2C_POLICY_NAME" = "B2C_1_signup_signin"
    "SCM_DO_BUILD_DURING_DEPLOYMENT" = "true"
    "WEBSITE_NODE_DEFAULT_VERSION" = "~18"
}

$cosmosConn = 'YOUR_COSMOS_DB_CONNECTION_STRING_HERE'

# Sätt varje setting
foreach ($key in $settings.Keys) {
    & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp config appsettings set `
        --resource-group rg-jrm-crm-prod `
        --name jrm-crm-api-prod-vsdmc5kbydcjc `
        --settings "$key=$($settings[$key])"
}

# Sätt Cosmos connection string separat
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp config connection-string set `
    --resource-group rg-jrm-crm-prod `
    --name jrm-crm-api-prod-vsdmc5kbydcjc `
    --connection-string-type Custom `
    --settings COSMOS_DB_CONNECTION_STRING=$cosmosConn
```
