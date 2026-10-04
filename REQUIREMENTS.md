# DT Essay-hjælper – krav og udviklingshistorik

Dette dokument fastholder de krav og designvalg, som DT Essay-hjælperen er bygget ud fra. Det er udviklingsdokumentation – ikke en ekstra tjekliste, som skal bruges ved siden af skrivefladen.

## Grundprincip

Værktøjet skal støtte skriveprocessen uden at overtage den faglige opgave.

Det skal især hjælpe med at:
- bevare overblik
- fastholde opgavekrav direkte dér, hvor der skrives
- styre ord og tegn
- opdage akademiske problemer uden at løse dem for brugeren
- skelne mellem empiri, teori og fortolkning
- fastholde proces og versioner
- kunne eksportere en ren opgavetekst til Word

Den akademiske vurdering skal være diagnostisk. Den må fx pege på, at et afsnit er beskrivende, at en påstand mangler belæg, at et begreb ikke arbejder analytisk, eller at en konklusion går længere end empirien bærer. Den skal ikke omskrive teksten eller fortælle præcist, hvordan problemet skal løses.

Stavning, tegnsætning og ordblindhedsrelaterede fejl er ikke en del af den akademiske vurdering.

## PF1 – baseline

PF1 er den oprindelige pilot og skal bevares som baseline.

### PF1 – centrale funktioner
- Problemformulering og kort indledning
- Metode
- Analyse
- Litteraturliste
- Vejledende tegnfordeling inden for 4.800 tegn
- Akademisk sprogtjek
- Teori- og kildepanel
- Feedbackpanel
- Versioner og lokal autosave
- Word-eksport

### Erfaringer fra brugen af PF1
De mest brugte funktioner var:
- akademisk vurdering
- ord-/tegntælling

Erfaringer, der skal bæres videre:
- Akademisk vurdering må gerne være mere krævende, men fortsat kun pege på problemet.
- Krav fungerer bedst integreret direkte i skriveblokkene frem for som en separat tjekliste.
- Konkret beskrivelse af metodearbejdet skal understøttes.
- Valg og fravalg skal kunne gøres synlige.
- Valgte teoribegreber skal begrundes i forhold til problemstillingen.
- Teoribegreber former blikket og afgrænser samtidig, hvad der bliver synligt.
- Analyse skal fastholde koblingen: Empiri → Teori → Fortolkning.
- Feedback skal kunne knyttes til et konkret tekststykke, fordi underviserfeedback i Docmost gives på markerede passager.
- Lokal browserlagring alene er ikke robust nok. PF1 blev mistet efter rydning af browserhistorik/site-data. Senere versioner skal derfor have en særskilt backupmulighed.

PF1 ændres ikke i PF2-versionen. Dens eksisterende lokale storage-nøgle bevares: `dtEssayHelper.pf1.v1`.

## PF2 – første justerede version

PF2 er første videreudvikling på baggrund af reel brug af PF1.

### Ramme
- Fællesskaber og netværk
- 3 normalsider
- Arbejdsramme: ca. 7.200 tegn
- Udkast: 6. oktober 2026 kl. 12
- Ordinær aflevering: 8. oktober 2026 kl. 12
- Udsættelse ansøgt til 11. oktober 2026

### Skrivefladens struktur
1. Problemformulering og kort indledning
2. Metode og empirisk materiale
3. Begreber / teori
4. Analyse
5. Fremtidigt arbejde
6. Litteraturliste

Krav og støtte skal ligge direkte i de relevante skriveblokke og kunne foldes sammen.

### PF2 – centrale designændringer
- PF2 åbnes som selvstændig arbejdsflade.
- PF1 forbliver urørt som baseline.
- PF3 og PF4 er synlige, men låste.
- PF2 viser både ord og tegn.
- Akademisk vurdering er mere udfordrende og diagnostisk.
- Vurderingen må kun sige, hvad der er et problem – ikke hvordan det skal løses.
- Feedback kan knyttes til en konkret markeret passage.
- Teoriområdet beholdes, men gøres ikke mere dominerende.
- PF2 får særskilt lokal lagring: `dtEssayHelper.pf2.v1`.
- PF2 kan eksportere en JSON-backup og indlæse den igen.
- Word-eksporten indeholder kun selve opgaveteksten.

### Akademisk vurdering – ønsket fokus
Vurderingen skal kunne pege på problemer inden for:
- præcision
- begrebsbrug
- påstand og belæg
- sammenhæng
- analyse frem for beskrivelse
- kobling mellem empiri, teori og fortolkning
- konklusioner, der går længere end materialet kan bære
- teori, der refereres, men ikke bruges analytisk

Den skal ikke:
- skrive en bedre formulering
- foreslå færdige sætninger
- lave analysen for brugeren
- rette stavning eller tegnsætning

## PF3 og PF4

PF3 og PF4 skal være synlige på forsiden, men må ikke kunne åbnes endnu.

De udvikles først, når PF2 er brugt og evalueret, så det kan dokumenteres, hvad der blev justeret fra PF1 til PF2, og hvad der senere ændres igen.

## Gemning og dokumentation

Browserens lokale lager må gerne bruges til løbende autosave, men må ikke være eneste sikkerhed.

Fra PF2 skal der være en tydelig backupfunktion, så arbejdet kan gemmes uden for browseren og genindlæses senere.

Versioner og arbejdsnoter er procesdokumentation og skal ikke med i den endelige Word-eksport.

## Visuel kontinuitet

Værktøjet skal bevare det genkendelige visuelle sprog fra den tidligere Diplomopgave-hjælper:
- mørkegrøn header
- lysegrønne støttefelter
- varm lys baggrund
- orange accent
- rolige hvide skrivefelter
- foldbare hjælpetekster
- sidepaneler, der kan lukkes

## Versionslog

### PF1 – pilot
Første fungerende version. Bruges som baseline.

### PF2 – v1
Første justering efter reel brug af PF1:
- PF2 åbnet
- PF1 bevaret
- PF3/PF4 låst
- mere krævende akademisk vurdering
- ord + tegn synliggjort
- feedback koblet til konkrete tekstpassager
- backup til fil tilføjet
- krav integreret i skriveflowet
