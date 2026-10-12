# DT Essay-hjælper – PF3 v1

Denne version videreudvikler den eksisterende DT Essay-hjælper med PF3 – Teknologi som kognitiv partner.

PF1 og PF2 bevares med deres eksisterende lokale storage-nøgler:
- `dtEssayHelper.pf1.v1`
- `dtEssayHelper.pf2.v1`

PF3 gemmes separat under:
- `dtEssayHelper.pf3.v1`

## Filer i pakken
- `index.html` – brugerfladen for PF1, PF2, PF3 og den låste PF4
- `styles.css` – design og layout
- `app.js` – funktionalitet, lokal lagring, vurdering, backup og Word-eksport
- `README.md` – teknisk overblik
- `REQUIREMENTS.md` – krav, læring og designvalg

## PF3 v1 – bevidste designvalg
PF3 skal støtte selvstændig akademisk tænkning uden at føre brugeren gennem analysen som en opskrift.

Derfor har PF3:
- én primær skriveflade
- korte, foldbare refleksionsspørgsmål
- én stor analyseflade frem for faste analysebokse
- Akademisk vurdering / “Udfordr teksten” som diagnose, ikke løsning
- en lille, foldbar kildenote med kun kilde, side og anvendelse
- feedback knyttet til markeret tekst
- lokal autosave, backup, versionshistorik og Word-eksport
- versionslisten foldet sammen som standard

PF3 har ikke:
- upload eller opbevaring af litteratur
- indbygget PDF-læser
- parallelbibliotek
- automatisk opgaveskrivning
- faste teorispor, der bestemmer analysens rækkefølge

## Data og backup
PF1, PF2 og PF3 gemmes separat i browserens lokale lager. PF2 og PF3 kan desuden eksporteres som JSON-backup og indlæses igen.

## GitHub Pages
Upload alle fem filer til roden af repository'et. Eksisterende browserdata fra PF1 og PF2 bevares, fordi deres storage-nøgler er uændrede.
