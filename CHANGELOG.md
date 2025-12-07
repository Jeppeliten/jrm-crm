# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.4] - 2025-11-03

### Added
- Complete security layer with WAF, SIEM, ATP, Zero Trust
- Automated backup system (4h dev / 24h prod)
- Health check endpoint (`/health`)
- Two-Factor Authentication (2FA) with TOTP
- SSL Security Manager with certificate monitoring
- Comprehensive audit logging
- Session timeout and concurrent session limiting
- Project restructuring to follow industry standards
- Complete documentation suite (deployment, maintenance, technical)

### Changed
- Improved project structure (separated docs, scripts, data)
- Enhanced rate limiting and input validation
- Updated security policies for production
- Optimized pipeline (Kanban) - removed move notifications

### Fixed
- Pipeline card move performance issues
- Session management edge cases
- Backup rotation and cleanup

### Security
- Implemented WAF with SQL injection and XSS protection
- Added SIEM with 6 correlation rules
- Enabled ATP with AI-based anomaly detection
- Configured Zero Trust architecture
- Enhanced password security with bcrypt

## [1.0.0] - 2025-09-01

### Added
- Initial CRM system release
- Customer management (brands, companies, agents)
- Sales pipeline with Kanban board
- Azure AD B2C integration
- Outlook integration via Microsoft Graph
- Visma.net integration for accounting data
- Basic reporting and dashboard
- Excel import/export functionality
- GDPR compliance features

---

## Upcoming Features

### [1.2.0] - Planned
- [ ] Migration to relational database (PostgreSQL/Azure SQL)
- [ ] Enhanced reporting with BI integration
- [ ] Mobile app (React Native)
- [ ] Advanced analytics and AI insights
- [ ] Webhook integrations
- [ ] Multi-tenant support

### [1.1.5] - Next Patch
- [ ] Performance optimizations
- [ ] Enhanced error handling
- [ ] Improved logging
- [ ] Additional unit tests
