#!/bin/bash
# Automated deployment script för CRM-systemet
# Användning: ./deploy-versioned.sh [environment] [version]

set -e  # Exit vid fel

# Färger för output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funktioner
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Parametrar
ENVIRONMENT=${1:-staging}
VERSION=${2:-"auto"}
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

log_info "🚀 Starting CRM deployment to $ENVIRONMENT"

# Validera environment
case $ENVIRONMENT in
    "staging"|"production"|"development")
        log_success "Environment: $ENVIRONMENT"
        ;;
    *)
        log_error "Invalid environment: $ENVIRONMENT"
        log_info "Valid environments: staging, production, development"
        exit 1
        ;;
esac

# Kontrollera att vi är i rätt directory
if [ ! -f "server/package.json" ]; then
    log_error "Must be run from project root directory"
    exit 1
fi

# Skapa backup
log_info "📦 Creating backup..."
mkdir -p $BACKUP_DIR
if [ -f "server/state.json" ]; then
    cp server/state.json "$BACKUP_DIR/state_${TIMESTAMP}.json"
    log_success "Backup created: $BACKUP_DIR/state_${TIMESTAMP}.json"
fi

# Git status check
if [ "$ENVIRONMENT" = "production" ]; then
    if ! git diff --quiet; then
        log_error "You have uncommitted changes. Commit or stash before production deployment."
        exit 1
    fi
    
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [ "$CURRENT_BRANCH" != "main" ]; then
        log_error "Production deployment must be from 'main' branch. Current: $CURRENT_BRANCH"
        exit 1
    fi
fi

# Version management
if [ "$VERSION" = "auto" ]; then
    cd server
    if [ "$ENVIRONMENT" = "production" ]; then
        npm version minor --no-git-tag-version
    else
        npm version patch --no-git-tag-version
    fi
    NEW_VERSION=$(node -p "require('./package.json').version")
    cd ..
    log_success "Auto-incremented version to: $NEW_VERSION"
else
    cd server
    npm version $VERSION --no-git-tag-version
    NEW_VERSION=$VERSION
    cd ..
    log_success "Set version to: $NEW_VERSION"
fi

# Install dependencies
log_info "📦 Installing dependencies..."
cd server
npm ci
log_success "Dependencies installed"
cd ..

# Syntax check
log_info "🔍 Running syntax checks..."
node -c server/index.js
node -c server/outlook-integration-server.js
log_success "Syntax checks passed"

# Build Docker image
log_info "🐳 Building Docker image..."
docker build -t "crm-app:$NEW_VERSION" -t "crm-app:latest" .
log_success "Docker image built: crm-app:$NEW_VERSION"

# Environment-specific deployment
case $ENVIRONMENT in
    "staging")
        log_info "🚀 Deploying to staging..."
        docker-compose -f docker-compose.staging.yml down || true
        docker-compose -f docker-compose.staging.yml up -d
        HEALTH_URL="http://localhost:3001/api/health"
        ;;
    "production")
        log_info "🚀 Deploying to production..."
        docker-compose -f docker-compose.production.yml down || true
        docker-compose -f docker-compose.production.yml up -d
        HEALTH_URL="http://localhost:3000/api/health"
        ;;
    "development")
        log_info "🚀 Starting development environment..."
        docker-compose down || true
        docker-compose up -d
        HEALTH_URL="http://localhost:3000/api/health"
        ;;
esac

# Health check
log_info "🔍 Running health check..."
sleep 10  # Vänta på att containern startar

for i in {1..30}; do
    if curl -f $HEALTH_URL >/dev/null 2>&1; then
        log_success "Health check passed"
        break
    fi
    if [ $i -eq 30 ]; then
        log_error "Health check failed after 30 attempts"
        log_warning "Rolling back..."
        docker-compose down
        exit 1
    fi
    log_info "Health check attempt $i/30..."
    sleep 2
done

# Success message
log_success "🎉 Deployment completed successfully!"
log_info "Version: $NEW_VERSION"
log_info "Environment: $ENVIRONMENT"
log_info "Health check URL: $HEALTH_URL"

# Git tag för production
if [ "$ENVIRONMENT" = "production" ]; then
    git add server/package.json
    git commit -m "chore: bump version to $NEW_VERSION"
    git tag "v$NEW_VERSION"
    log_success "Created git tag: v$NEW_VERSION"
    log_info "Push with: git push origin main --tags"
fi

log_success "🚀 Deployment complete! CRM is running on $ENVIRONMENT"