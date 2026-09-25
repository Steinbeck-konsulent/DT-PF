# DT Essay-hjælper – PF1 pilot

Browserbaseret skrive- og procesværktøj til **Digitale Teknologier 2026** på Kandidatuddannelsen i IT-didaktisk design.

## Pilotens formål

PF1 er første pilot. Værktøjet skal støtte overblik, pladsstyring, teori/empiri-kobling, akademisk sprog og feedbackproces uden at skrive opgaven for den studerende.

## PF1-funktioner

- Forside med PF1–PF4 og de aftalte deadlines.
- PF1-arbejdsflade med problemformulering/indledning, metode, analyse og litteraturliste.
- Sammenklappeligt feedbackpanel til venstre.
- Sammenklappeligt teori- og kildepanel til højre.
- Tegntæller med arbejdsfordeling 15 % / 20 % / 65 % af 4.800 tegn.
- Hjælpetekster direkte ved de relevante afsnit.
- Akademisk sprogtjek, som **ikke** vurderer stavning eller tegnsætning og ikke omskriver teksten.
- Autosave i browserens `localStorage`.
- Manuel og automatisk versionshistorik.
- Upload af feedback fra `.docx`, `.pdf` eller `.txt` samt mulighed for at indsætte tekst direkte.
- Eksport af selve essayet til `.docx`. Procesnoter, feedback og hjælpetekster kommer ikke med i eksporten.

## Data

Alt studieindhold og versionshistorik gemmes lokalt i den browser, hvor værktøjet bruges. Eksterne biblioteker hentes fra CDN ved brug af Word-eksport og feedbackimport.

## Eksterne browserbiblioteker

- `docx` 8.5.0 til Word-eksport.
- `mammoth` 1.12.3 til tekstudtræk fra `.docx`-feedback.
- `pdf.js` 4.10.38 indlæses dynamisk ved PDF-feedback.

## Evaluering efter PF1

Før PF2 bygges, evalueres især:

- om hjælpeteksterne er tilstrækkelige uden at blive styrende,
- om tegnfordelingen fungerer,
- om analysehjælpen reelt støtter koblingen mellem empiri og teori,
- om sprogtjekket er nyttigt,
- om feedback-loopet fungerer,
- om browserlagring og versionering er tilstrækkelig.
