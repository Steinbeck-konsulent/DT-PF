# DT Essay-hjælper – PF2-version

Denne mappe indeholder den komplette version af DT Essay-hjælperen, hvor PF1 bevares som baseline, og PF2 er åbnet som første justerede version efter reel brug af PF1.

## Filer i pakken
- `index.html` – brugerfladen
- `styles.css` – design og layout
- `app.js` – funktionalitet, lagring, vurdering, backup og eksport
- `README.md` – kort teknisk overblik og installationsvejledning
- `REQUIREMENTS.md` – krav, designprincipper og udviklingshistorik fra PF1 til PF2

## Bevidste designvalg
- PF1 bruger fortsat samme lokale storage-nøgle: `dtEssayHelper.pf1.v1`.
- PF2 gemmes separat: `dtEssayHelper.pf2.v1`.
- PF1 bevares som baseline og ændres ikke funktionelt i PF2-versionen.
- PF3 og PF4 er synlige, men låste.
- PF2 viser både ord og tegn.
- PF2 har en mere udfordrende akademisk diagnose, som peger på problemer uden at foreslå løsninger.
- PF2-feedback kan knyttes til en konkret tekstmarkering.
- PF2 kan eksportere og indlæse en JSON-backup, så arbejdet ikke kun afhænger af browserens lokale lager.
- Word-eksporten indeholder kun selve opgaveteksten – ikke feedback, proces, teoriarbejdsnoter eller akademisk vurdering.

## Installation på GitHub Pages
1. Slet de eksisterende filer i roden af `Steinbeck-konsulent/DT-PF`.
2. Pak ZIP-filen ud på din computer.
3. Upload **alle fem filer** direkte til repoets rod:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
   - `REQUIREMENTS.md`
4. Commit ændringen.
5. GitHub Pages opdaterer derefter den eksisterende side.

Upload filerne direkte i roden – ikke mappen `DT-PF-PF2-v1` som en undermappe.
