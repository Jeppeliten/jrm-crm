#!/bin/bash
# Azure Deployment Fix Script
# Kör detta i Azure Portal Cloud Shell (Bash)

echo "🚀 Starting Azure Deployment Fix..."

# Variables
RESOURCE_GROUP="rg-jrm-crm-prod"
APP_NAME="jrm-crm-api-prod-vsdmc5kbydcjc"
REPO_URL="https://varderingsdata.visualstudio.com/VD%20Laboratory/_git/JRM"
BRANCH="master"

echo "📋 Step 1: Configuring App Settings..."
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    PROJECT=server \
    SCM_DO_BUILD_DURING_DEPLOYMENT=true \
    WEBSITE_NODE_DEFAULT_VERSION=~20 \
    NODE_ENV=production

echo "📋 Step 2: Removing old deployment source..."
az webapp deployment source delete \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP

echo "📋 Step 3: Configuring new deployment source..."
az webapp deployment source config \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --repo-url $REPO_URL \
  --branch $BRANCH \
  --manual-integration

echo "📋 Step 4: Syncing deployment..."
az webapp deployment source sync \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP

echo "⏳ Waiting 60 seconds for deployment..."
sleep 60

echo "🧪 Testing health endpoint..."
curl -s https://$APP_NAME.azurewebsites.net/health | jq .

echo "🧪 Testing brands endpoint..."
curl -s https://$APP_NAME.azurewebsites.net/api/brands | jq .

echo "✅ Deployment script completed!"
echo ""
echo "📍 Frontend: https://lively-grass-0a14e0d03.3.azurestaticapps.net"
echo "📍 Backend: https://$APP_NAME.azurewebsites.net"
