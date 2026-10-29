# Play Cuneo

La pubblicità che si gioca. Mini-giochi pubblicitari da venti secondi, con il marchio
dell'azienda e **un solo pulsante** alla fine.

Le demo usano **marchi inventati**: nessuna azienda reale è coinvolta.

## Struttura

```
index.html                        ← la landing (link in bio)
giochi/
  <numero>-<slug>/index.html      ← un gioco per cartella, un solo file autonomo
README.md
```

## Aggiungere una puntata

1. Il file del gioco si costruisce da `agent-skill/templates/base.html` nel progetto di lavoro.
2. Collaudo obbligatorio prima di pubblicare:
   ```
   node agent-skill/tools/check.mjs <file>.html
   ```
   Deve uscire `TUTTO OK — pubblicabile`.
3. Si copia in `giochi/<numero>-<slug>/index.html` e si aggiunge la card in `index.html`.

## Regole dei giochi

- un solo `.html` per gioco, nessuna libreria, nessun CDN, nessun font esterno
- sotto gli 80 KB
- zero immagini e zero audio: canvas + Web Audio
- partita da 10 a 30 secondi, un solo invito all'azione
- niente raccolta dati personali dentro il gioco
- per alcol, salute, finanza: testo non rivolto ai minori, nessuna promessa di risultato

## Contatti

WhatsApp: [scrivimi](https://wa.me/393389855696?text=Ciao%21%20Ho%20visto%20play%20cuneo%20e%20vorrei%20il%20mio%20gioco)
