# GleSYS SSH Setup Guide
# Sätt upp SSH-nycklar för säker anslutning

## 🔑 SSH-Nycklar för GleSYS

### Steg 1: Generera SSH-nyckel
Öppna **PowerShell som administratör** och kör:

```powershell
# Generera ny SSH-nyckel
ssh-keygen -t ed25519 -C "crm-admin@ditt-företag.se"

# När du blir tillfrågad:
# File location: Tryck Enter (använd standard)
# Passphrase: Ange ett starkt lösenord (rekommenderat)
```

### Steg 2: Kopiera publik nyckel
```powershell
# Visa och kopiera din publika nyckel
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub"

# Eller kopiera direkt till clipboard
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub" | Set-Clipboard
```

### Steg 3: Lägg till i GleSYS
1. Logga in på **https://customer.glesys.com/**
2. Gå till "**SSH-nycklar**" i menyn
3. Klicka "**Lägg till nyckel**"
4. Klistra in din publika nyckel
5. Namnge nyckeln: "CRM-Admin-Nyckel"
6. Spara

## ✅ Bekräfta SSH-setup
När VPS:en är klar, testa anslutning:
```powershell
ssh root@DIN_VPS_IP
# Eller
ssh crmadmin@DIN_VPS_IP
```

## 🚨 Säkerhetstips
- Använd alltid stark passphrase på SSH-nyckeln
- Dela ALDRIG din privata nyckel (.ssh/id_ed25519)
- Den publika nyckeln (.ssh/id_ed25519.pub) är OK att dela

## 📞 Hjälp vid problem
Om SSH inte fungerar, kontakta GleSYS support:
- Telefon: +46 31 19 00 60
- Email: support@glesys.se
- De hjälper gärna med SSH-setup!