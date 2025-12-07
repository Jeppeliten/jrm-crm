# CRM Säkerhetsguide

## Lösenordspolicy

### Minimikrav:
- Minst 8 tecken
- Blandning av stora/små bokstäver
- Minst en siffra
- Minst ett specialtecken

### Rekommenderade lösenord:
- `Säker2024!CRM` 
- `Mäklare#456Sys`
- `KundData$789!`

## Användarroller

### Admin
- **Behörigheter**: Full åtkomst till allt
- **Kan**: Hantera användare, ta bort data, importera, exportera
- **Använd för**: Systemadministratör

### Sales
- **Behörigheter**: Redigera kunder, mäklare, företag
- **Kan**: Läsa/skriva all CRM-data, exportera
- **Kan inte**: Hantera användare, ta bort stora datamängder
- **Använd för**: Säljare, kontoansvariga

### ReadOnly (kan läggas till)
- **Behörigheter**: Endast läsåtkomst
- **Kan**: Se dashboard, rapporter, exportera
- **Kan inte**: Redigera data
- **Använd för**: Chefer, rapportanvändare

## Säkerhetsbästa praxis

### För Administratörer:
1. **Unika lösenord**: Varje användare har unikt lösenord
2. **Regelbundna byten**: Byt lösenord var 90:e dag
3. **2FA**: Överväg tvåfaktorsautentisering för admin
4. **Audit**: Granska audit-loggar månadsvis
5. **Backups**: Testa återställning kvartalsvis

### För Användare:
1. **Logga ut**: Alltid logga ut när sessionen är klar
2. **Lås skärm**: Lås datorn när du lämnar den
3. **Uppdateringar**: Håll webbläsaren uppdaterad
4. **WiFi**: Använd inte öppna WiFi-nätverk
5. **Rapportera**: Rapportera misstänkt aktivitet omedelbart

## Incident Response

### Vid misstänkt intrång:
1. **Omedelbar åtgärd**: Byt admin-lösenord
2. **Logga ut alla**: Rensa alla aktiva sessioner
3. **Granska**: Kontrollera audit-loggar för onormal aktivitet
4. **Dokumentera**: Logga incident och åtgärder
5. **Återställ**: Återställ från backup om nödvändigt

### Kontaktinfo vid nödsituation:
- IT-ansvarig: [din e-post]
- Hosting-support: [leverantörens support]
- Backup-ansvarig: [ansvarig person]

## Compliance och GDPR

### Datahantering:
- **Retention**: Kundata sparas max 7 år
- **Right to be forgotten**: Rutiner för att radera persondata
- **Access logs**: All dataåtkomst loggas
- **Consent**: Dokumenterad grund för databehandling

### Audit Trail:
- Alla inloggningar loggas
- Alla dataändringar loggas  
- Alla exporter loggas
- Loggar sparas i 1 år