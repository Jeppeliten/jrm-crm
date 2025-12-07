# Outlook Integration - Riktig Setup

För att ansluta till Outlook på riktigt behöver du konfigurera Microsoft Graph API. Här är steg-för-steg guide:

## 1. Registrera app i Azure AD

1. Gå till [Azure Portal](https://portal.azure.com)
2. Navigera till "Azure Active Directory" > "App registrations"
3. Klicka "New registration"
4. Fyll i:
   - **Name**: "CRM Outlook Integration"
   - **Supported account types**: "Accounts in any organizational directory and personal Microsoft accounts"
   - **Redirect URI**: `http://localhost:3000/crm-prototype/auth/callback`
5. Klicka "Register"

## 2. Konfigurera API-behörigheter

1. I din nya app, gå till "API permissions"
2. Klicka "Add a permission" > "Microsoft Graph" > "Delegated permissions"
3. Lägg till följande behörigheter:
   - `User.Read` - Läsa användaruppgifter
   - `Mail.Read` - Läsa e-post
   - `Mail.Send` - Skicka e-post
   - `Calendars.ReadWrite` - Läsa/skriva kalender
   - `Contacts.Read` - Läsa kontakter
4. Klicka "Grant admin consent" (om du är admin)

## 3. Hämta konfiguration

1. Gå till "Overview" i din app
2. Kopiera:
   - **Application (client) ID** - Detta är din `clientId`
   - **Directory (tenant) ID** - Detta är din `tenantId`

## 4. Uppdatera CRM-konfiguration

Skapa/uppdatera filen `server/.env`:

```env
# Microsoft Graph API Configuration
MICROSOFT_CLIENT_ID=din-application-client-id-här
MICROSOFT_TENANT_ID=din-directory-tenant-id-här
MICROSOFT_REDIRECT_URI=http://localhost:3000/crm-prototype/auth/callback
```

## 5. Installera nödvändiga paket

```bash
cd server
npm install @azure/msal-node @microsoft/microsoft-graph-client
```

## 6. Produktionsöverväganden

### För produktion behöver du:

1. **HTTPS** - Microsoft Graph kräver HTTPS i produktion
2. **Domän** - Registrera din riktiga domän som redirect URI
3. **Client Secret** - För server-side autentisering (valfritt)
4. **Skapa organization app** - För företagsintern användning

### Säkerhetsöverväganden:

- Lagra aldrig client secrets i frontend-kod
- Använd säkra cookies för tokens
- Implementera token refresh-logik
- Logga all API-användning för audit

## 7. Begränsningar och kostnader

- **Microsoft Graph API** har rate limits
- **Microsoft 365** licens krävs för vissa funktioner  
- **Utvecklartestning** är gratis
- **Produktionsanvändning** kan kräva betald licens

## 8. Alternativa lösningar

Om Microsoft Graph är för komplext:

1. **IMAP/SMTP** - Direkt e-postprotokoll
2. **Exchange Web Services (EWS)** - Äldre men enklare
3. **Third-party services** - Zapier, Microsoft Power Automate
4. **Outlook Add-ins** - Integrering inom Outlook själv

## 9. Testning

1. Använd ett Microsoft-testkonto
2. Testa alla behörigheter individuellt
3. Hantera fel och rate limits
4. Testa offline-scenarios

Vill du att jag hjälper dig implementera någon av dessa steg?