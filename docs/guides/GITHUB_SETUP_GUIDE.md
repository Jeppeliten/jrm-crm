# GitHub Remote Setup Guide

## 🔗 Anslut till GitHub Repository

### Steg 1: Skapa Repository på GitHub
1. Gå till https://github.com
2. Klicka "+" → "New repository"  
3. Namn: `crm-maklar-system`
4. Beskrivning: `Professional CRM system for real estate industry`
5. Välj Private/Public enligt önskemål
6. **Skapa UTAN** README, .gitignore eller license (vi har redan)

### Steg 2: Anslut lokalt repo till GitHub
```powershell
# Ersätt USERNAME med ditt GitHub-användarnamn
git remote add origin https://github.com/USERNAME/crm-maklar-system.git

# Pusha alla branches
git push -u origin master
git push -u origin develop  
git push -u origin staging

# Sätt master som default branch
git branch --set-upstream-to=origin/master master
```

### Steg 3: Verifiera anslutning
```powershell
git remote -v
git branch -a
```

### Steg 4: Aktivera GitHub Actions (CI/CD)
1. Gå till ditt repo på GitHub
2. Klicka "Actions" tab
3. GitHub kommer automatiskt hitta `.github/workflows/ci-cd.yml`
4. Klicka "I understand my workflows, go ahead and enable them"

### Steg 5: Sätt upp Branch Protection (Rekommenderat)
1. Gå till Settings → Branches
2. Klicka "Add rule" för `main`/`master` branch
3. Aktivera:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging

## 🔐 SSH Setup (Valfritt men rekommenderat)

### Generera SSH-nyckel:
```powershell
ssh-keygen -t ed25519 -C "din-email@example.com"
```

### Lägg till SSH-nyckel på GitHub:
1. Kopiera public key: `cat ~/.ssh/id_ed25519.pub`
2. GitHub → Settings → SSH and GPG keys → New SSH key
3. Klistra in nyckeln

### Byt till SSH remote:
```powershell
git remote set-url origin git@github.com:USERNAME/crm-maklar-system.git
```

## 🎯 Daglig Workflow med GitHub

### Feature Development:
```powershell
# Skapa feature branch
git checkout develop
git pull origin develop
git checkout -b feature/ny-funktionalitet

# Utveckla och commita
git add .
git commit -m "feat: add new functionality"

# Pusha och skapa Pull Request
git push origin feature/ny-funktionalitet
# Gå till GitHub och skapa Pull Request till develop
```

### Release Process:
```powershell
# Staging release
git checkout staging
git merge develop
git push origin staging
# Auto-deploy körs via GitHub Actions

# Production release  
git checkout master
git merge staging
git push origin master
# Production deploy körs via GitHub Actions
```

## 📊 GitHub Features som aktiveras:

- **Issues**: Spåra buggar och feature requests
- **Pull Requests**: Code review process
- **Actions**: CI/CD automation  
- **Wiki**: Dokumentation
- **Releases**: Tagged versions med release notes
- **Security**: Dependency scanning och secrets detection

## 🔧 Lokala Git Aliases (Valfritt)

Lägg till i `.gitconfig` för enklare kommandon:
```ini
[alias]
    st = status
    co = checkout
    br = branch
    ci = commit
    pl = pull
    ps = push
    lg = log --oneline --graph --decorate --all
    unstage = reset HEAD --
```

## 🚨 Viktiga Säkerhetsöverväganden

### ⚠️ Checka ALDRIG in:
- `.env` filer med secrets
- `server/state.json` (kunddata)
- API-nycklar eller lösenord
- SSL-certifikat

### ✅ Använd istället:
- GitHub Secrets för CI/CD
- Environment variables
- `.env.example` som mall
- Azure Key Vault för produktion

---

**När du har skapat GitHub repo, kör:**
```powershell
git remote add origin https://github.com/DITT-ANVÄNDARNAMN/crm-maklar-system.git
git push -u origin master
```