# Implementationsplan: Azure CRM Enterprise

Detta dokument beskriver övergången från prototyp till ett produktionsklart system i Azure med stöd för autentisering, databas och säljstyrning.

## 1. Arkitektur (Azure Stack)
*   **Frontend**: React (Vite) distribuerat via **Azure Static Web Apps**.
*   **Backend**: **Azure Functions** (Node.js) integrerat i Static Web App för API-anrop.
*   **Databas**: **Azure Cosmos DB** (för MongoDB API) för att lagra mäklardata, säljaranteckningar, uppgifter och affärsstatus.
*   **Autentisering**: **Microsoft Entra ID** (tidigare Azure AD). SWA har inbyggt stöd för detta genom `/.auth/login/aad`.

## 2. Nya Funktioner
### A. Säljtavla (Kanban)
*   Visualisering av leads genom olika steg: `Prospekt` -> `Kontaktad` -> `Möte Bokat` -> `Förhandling` -> `Vunnen/Förlorad`.
*   Möjlighet att dra och släppa (Drag & Drop) företag/kedjor mellan stadier.

### B. Uppgiftshantering
*   Skapa uppgifter kopplade till specifika mäklare, företag eller kedjor.
*   Tilldela uppgifter till sig själv eller kollegor (hämtas via Entra ID).
*   Notifikationer/Deadlines för uppföljning.

### C. Databas-synk
*   En bakgrundsprocess (Azure Function med Timer Trigger) som kan läsa in nya Excel-filer och uppdatera MongoDB-databasen utan att skriva över manuella säljanteckningar.

## 3. Implementationssteg (Steg för steg)
1.  **Strukturera om UI**: Lägg till navigation för "Säljtavla" och "Mina Uppgifter".
2.  **API-lager**: Skapa `/api`-mapp för Azure Functions som hanterar CRUD för uppgifter och statusuppdateringar.
3.  **Entra ID Integration**: Implementera logik för att läsa in den inloggade säljarens profil.
4.  **Schema-design**: Definiera MongoDB-samlingar för `leads` (affärsstatus) och `tasks`.

---
*Planen uppdateras löpande under utvecklingens gång.*
