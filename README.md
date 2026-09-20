# Foundry VTT - Fantasy Grounds Importer

Un modulo per **Foundry VTT** (sistema **dnd5e**) che importa le schede personaggio D&D 5e esportate in **XML** da **Fantasy Grounds** ("Export a Character"), creando o aggiornando attori.

## Compatibilità

- Foundry VTT **v12** (testato su 12.343, minimo dichiarato 11)
- Sistema dnd5e **3.3.1** (minimo 3.0.0)

## Caratteristiche

### 📥 Import da Fantasy Grounds
Importa personaggi direttamente dai file XML esportati da Fantasy Grounds (formato `<characters version="5">`).
- **Attributi:** abilità, saving throw, skill (con abilità associata).
- **Combattimento:** AC, HP, movimento, iniziativa.
- **Identità:** razza (+ sottorazza), classi (con livelli e dadi di colpo), livello totale derivato, taglia.
- **Armi:** ogni azione del personaggio (`|+6|1d6+3`) diventa un'arma con bonus d'attacco fisso e formula di danno; il tipo (simple/martial/natural) viene dedotto dal nome.
- **Ritratto:** se presente nell'export, viene salvato nel data folder.
- Ogni `<pc>` nel file crea un attore separato.

### 🔁 Ri-import / aggiornamento
Gli item creati dal modulo (razza, classi, armi) vengono marcati con il flag `managedByFgImporter`. Ri-importando sullo stesso attore vengono rimossi e rigenerati, senza toccare gli item creati a mano.

## Installazione

### Tramite URL (consigliato)
1. Apri **File → Manage & Configure Add-ons → Modules**.
2. Clicca **Install Module** (in alto a destra).
3. Incolla il **Manifest URL**:

   ```
   https://github.com/Shinigallo/foundry-fantasy-grounds-importer/releases/latest/download/module.json
   ```

4. Clicca **Install**.

### Manuale
1. Scarica il `module.zip` dall'ultimo [release](https://github.com/Shinigallo/foundry-fantasy-grounds-importer/releases).
2. Decomprimalo nella cartella `Data/modules/` di Foundry (dentro deve esserci `module.json`).
3. Attiva il modulo in **Manage & Configure Add-ons → Modules**.

## Utilizzo

- **Pulsante sidebar:** "Import FG XML" nella lista degli attori.
- **Pulsante scheda:** nell'header della scheda attore (tipo character): aggiorna quell'attore.
- **Hotkey:** `F9`.
- Disponibile solo per il **GM**.

Seleziona il file XML esportato da Fantasy Grounds e conferma con **Importa**.

## Struttura del file

```
foundry-fantasy-grounds-importer/
├── module.json
├── README.md
├── scripts/
│   ├── main.js      # UI: bottoni, dialog, hotkey
│   └── import.js    # parsing XML e mapping nel modello dnd5e 3.x
└── styles/
    └── module.css
```

Nessun step di build: è sufficiente la cartella del modulo.
