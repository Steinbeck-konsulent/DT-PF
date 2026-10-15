# DT Essay-hjælper – krav og udviklingshistorik

## Grundprincip
Værktøjet skal støtte skriveprocessen uden at overtage den faglige opgave.

Det skal hjælpe brugeren med at:
- bevare overblik
- fastholde opgavekrav tæt på skrivearbejdet
- styre ord og tegn
- opdage akademiske problemer uden at få løsningen
- skelne mellem empiri, teori og fortolkning
- bevare egne formuleringer og analytiske valg
- gemme proces, versioner og backup
- eksportere en ren opgavetekst til Word

Den akademiske vurdering er diagnostisk. Den må pege på fx en lang sætning, et uklart belæg, en uklar metodebegrundelse, beskrivelse frem for analyse eller en konklusion, der går længere end materialet kan bære. Den må ikke omskrive teksten eller fortælle præcist, hvordan problemet skal løses.

Stavning, tegnsætning og ordblindhedsrelaterede fejl er ikke en del af den akademiske vurdering.

## Tværgående designregel
Appen må aldrig kræve mere overblik end selve opgaven.

Funktioner, der skaber parallel administration, skal som udgangspunkt fjernes eller foldes væk. Hvis en funktion primært hjælper brugeren til at tænke mere selv, kan den bevares. Hvis den primært giver mere administration, skal dens værdi dokumenteres gennem faktisk brug.

## PF1 – baseline
PF1 er den oprindelige pilot og bevares med storage-nøglen `dtEssayHelper.pf1.v1`.

Centrale erfaringer:
- akademisk vurdering og tegn/ord-overblik var nyttige
- empiri → teori → fortolkning er en hjælpsom påmindelse
- lokal browserlagring alene er ikke robust nok som eneste sikkerhed

## PF2 – første udviklingsversion
PF2 gemmes separat under `dtEssayHelper.pf2.v1`.

PF2 videreførte bl.a.:
- ord- og tegntælling
- justerbar tegnfordeling
- kontekstuel feedback på markeret tekst
- versionshistorik
- JSON-backup
- Word-eksport
- Akademisk vurdering / “Udfordr teksten”

### Læring fra PF2
Det store “Teori & kilder”-panel blev ikke brugt i praksis. Funktionen krævede for mange parallelle registreringer og blev et ekstra sted at holde øje med information.

De generiske hjælpetekster med “Tjek” og “Pas på” fungerede heller ikke godt nok. De var for kontrollerende og for lidt knyttet til brugerens konkrete tænkning.

Akademisk vurdering fungerede derimod godt, fordi den pegede på konkrete steder i brugerens egen tekst og sendte brugeren tilbage til teksten med et nyt blik.

## PF3 – Teknologi som kognitiv partner
PF3 gemmes separat under `dtEssayHelper.pf3.v1`.

Ramme:
- 5 normalsider
- arbejdsramme ca. 12.000 tegn
- udkast 25. november 2026 kl. 12
- aflevering 27. november 2026 kl. 12

Opgaven retter blikket mod en konkret situation, hvor mennesker interagerer med en teknologi. Analysen skal kunne belyse:
- hvilke særlige aktiviteter teknologien muliggør
- hvilken rolle teknologien spiller i konteksten og aktiviteterne
- hvori læringspotentialerne består

PF3 må ikke på forhånd låses til én bestemt teknologi eller til selve essay-hjælperen som case.

### PF3 v1 – struktur
1. Titel, indledning og problemformulering
2. Metode og empirisk materiale
3. Begreber og teori
4. Analyse
5. Læringspotentiale og afrunding
6. Litteraturliste

### PF3 v1 – hjælpetekster
Hjælpetekster skal invitere til at se på egen tekst og eget materiale igen. De skal ikke fortælle brugeren, hvad der skal findes.

Eksempler:
- Hvad er det helt konkret, du er blevet nysgerrig på?
- Hvad har du faktisk materiale til at sige noget om?
- Hvad tror du selv lige nu, at du vil finde?
- Hvad kunne overraske dig?
- Hvornår går du fra det observerede til din egen fortolkning?
- Er der noget i materialet, der ikke passer med din første forståelse?

### PF3 v1 – kildenote
PF3 har ikke et litteraturbibliotek. Der er kun en lille foldbar kildenote med:
- kilde
- side
- hvad bruger jeg den til?

Funktionen evalueres efter PF3. Hvis den ikke bruges, er det et signal om, at kildearbejdet hører hjemme uden for appen.

### PF3 v1 – Akademisk vurdering
Funktionen bevares synligt nederst i skriveflowet.

Den må fx pege på:
- lange sætninger
- uklar metodebegrundelse
- uklar empirisk forankring
- teori, der refereres uden tydelig analytisk funktion
- påstande, der kan være stærkere end materialet bærer
- teknologi, der får en automatisk forklarende rolle
- uklar skelnen mellem observation og fortolkning
- læringspotentiale, der ikke er tydeligt i afrundingen

Den må ikke foreslå færdige formuleringer eller løsninger.

### PF3 v1 – proces og versioner
Versionshistorikken bevares, men listen er foldet sammen som standard. Den skal være tilgængelig uden at fylde i det daglige skrivearbejde.

## No-go
- automatisk opgaveskrivning
- litteraturupload som standardfunktion
- indbygget dokumentbibliotek
- mange parallelle steder, der kræver opmærksomhed
- faste analysebokse, der bestemmer brugerens analytiske rækkefølge
- teori som facit
- akademisk vurdering, der løser problemet for brugeren

## Udviklingsprincip
Byg kun det, der dokumenteret hjælper brugeren med at tænke, skrive og vende tilbage til sin egen tekst med nye øjne.


## Branding og transparens
- Steinbeck-logoet skal være synligt, men diskret, i appens header.
- Det eksisterende Steinbeck AI-mærke skal vises i sidefoden.
- Der må ikke improviseres nye logoer eller AI-mærker.
