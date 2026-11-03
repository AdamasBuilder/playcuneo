# Play Cuneo

La pubblicità che si gioca. Mini-giochi pubblicitari da venti secondi, con il marchio
dell'azienda e **un solo pulsante** alla fine.

Le demo usano **marchi inventati**: nessuna azienda reale è coinvolta.

## Struttura

```
index.html                        ← la landing (link in bio)
motore.js                         ← il motore: intro, HUD, finale, CTA, audio, input
mech-sort.js                      ← meccanica "smista" (danno/cura, vale/no)
mech-memory.js                    ← meccanica "coppie"
mech-timing.js                    ← meccanica "barra di precisione"
giochi/
  <numero>-<slug>/index.html      ← un gioco per cartella (4–30 KB)
README.md
```

## Aggiungere una puntata

Un gioco nuovo sono **tre passi**: configurazione, contenuto, collaudo.

```bash
# 1. genera il file (0,2 secondi) — cambia solo la configurazione
node agent-skill/tools/new-game.mjs --slug <nome> --mech sort \
     --brand "MARCA" --title "TITOLO" --cta "PRENOTA ORA" \
     --url "https://..." --out giochi

# 2. sostituisci i contenuti (le carte, i simboli, i testi della schermata finale)

# 3. collauda — entrambi devono essere verdi
node agent-skill/tools/check.mjs giochi/<n>-<slug>/index.html
python agent-skill/tools/qa.py   giochi/<n>-<slug>/index.html
```

Poi si aggiunge la card in `index.html` (la landing).

**Le regole del motore stanno in `agent-skill/motore-api.md`** nel progetto di lavoro:
una meccanica usa solo le API documentate lì, altrimenti il gioco si rompe.

## Regole dei giochi

- un solo `.html` per gioco (+ il motore e un modulo meccanica, condivisi)
- nessuna libreria, nessun CDN, nessun font esterno
- sotto gli 80 KB
- zero immagini e zero audio: canvas + Web Audio
- partita da 10 a 30 secondi, un solo invito all'azione
- niente raccolta dati personali dentro il gioco
- per alcol, salute, finanza: testo non rivolto ai minori, nessuna promessa di risultato

## Contatti

WhatsApp: [scrivimi](https://wa.me/393389855696?text=Ciao%21%20Ho%20visto%20play%20cuneo%20e%20vorrei%20il%20mio%20gioco)
