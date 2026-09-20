# FG 5e XML Importer

Modulo per **Foundry VTT v13** (sistema ufficiale **dnd5e** 4.x) che importa schede personaggio D&D 5e esportate in XML da **Fantasy Grounds** (funzione "Export a Character", formato `<characters version="5">`).

Stesso stile e convenzioni di [`foundry-5e-companion-importer`](https://github.com/Shinigallo/foundry-5e-companion-importer).

## Caratteristiche

- **Pulsante nella sidebar** (sotto la lista Attori) per l'import globale: ogni `<pc>` presente nel file XML crea un actor separato.
- **Pulsante nell'header della scheda actor** per aggiornare l'actor aperto con i dati di un file XML.
- **Hotkey F9** per aprire la finestra di import (funziona quando non si sta digitando in un campo).
- Importazione di:
  - nome, livello, taglia, iniziativa, CA, PF (attuale e massimi), velocità
  - caratteristiche e proficienze di **saving throw** (in dnd5e 4.4.x la proficienza di saving vive sul campo `proficient` dell'abilità)
  - proficienze di skill
  - razza (con sottorazza) e classi con livello e dado di PF
  - azioni/attacchi → item `weapon` con bonus d'attacco fisso e danno (tipo danno letto dal testo)
  - ritratto base64, salvato in `Data/fg-imports/`
- Gli item generati dal modulo sono marcati con il flag `foundry-fantasy-grounds-importer.managedByFgImporter`: al ri-import su uno stesso actor vengono eliminati e ricreati solo quelli, senza toccare il resto della scheda.
- I tag XML non riconosciuti vengono ignorati (e i valori mancanti lasciano i campi di default di dnd5e).

## Installazione

1. Copia la cartella `foundry-fantasy-grounds-importer/` in `{data}/Data/modules/` di Foundry VTT.
2. Riavvia Foundry VTT (o ricarica la world).
3. In **Module Management** abilita *FG 5e XML Importer*.

> Il modulo richiede il sistema **dnd5e** (verificato con 4.4.x) e i permessi di **GM**.

## Uso

- **Import globale:** nella sidebar, sotto la lista Attori, clicca *Import FG XML* (oppure premi **F9**), seleziona il file `.xml` e conferma.
- **Aggiornamento di un actor esistente:** apri la scheda del personaggio e clicca il pulsante con l'icona "import" nell'header della scheda, poi seleziona il file `.xml` corrispondente.

## Formato XML atteso

```xml
<?xml version="1.0" encoding="UTF-8"?>
<characters version="5">
  <pc>
    <label>Kip “Zanna verde” Underbough</label>
    <name>Halfling, Ghostwise Druid 4/Monk 3</name>
    <level>7</level>
    <size>S</size>
    <init>3</init>
    <ac>16</ac>
    <hp>59/59 (4d8+3d8)</hp>
    <speed>35 ft.</speed>
    <str>8</str><dex>16</dex><con>16</con><int>10</int><wis>16</wis><cha>8</cha>
    <save>Intelligence +3</save>
    <save>Wisdom +6</save>
    <skill>Insight +6</skill>
    <action>
      <name>Quarterstaff</name>
      <text>Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 1d6 + 3 bludgeoning damage.</text>
      <attack>|+6|1d6+3</attack>
    </action>
    <portrait>/9j/4AAQ...</portrait>
  </pc>
</characters>
```

### Mapping dei campi

| XML | dnd5e 4.4.x |
|---|---|
| `label` | `actor.name` |
| `name` | item `race` (con `subtype`) + item `class` (uno per `Nome N`) |
| `level` | `system.details.level` |
| `size` | `system.traits.size` (S→`sm`, M→`med`, …) |
| `init` | `system.attributes.init.bonus` |
| `ac` | `system.attributes.ac = {calc:"flat", flat}` |
| `hp` | `system.attributes.hp.{value,max}` |
| `speed` | `system.attributes.movement.walk` |
| `str…cha` | `system.abilities.<k>.value` |
| `save` | `system.abilities.<k>.proficient = 1` |
| `skill` | `system.skills.<chiave abbreviata>.value = 1` |
| `action` | item `weapon` con activity `attack` (bonus e danno) |
| `portrait` | immagine in `Data/fg-imports/` + `actor.img` |

## Struttura del modulo

```
foundry-fantasy-grounds-importer/
├── module.json        # manifest
├── main.js            # UI: bottoni, hotkey, dialog
├── import.js          # parsing XML + mapping dnd5e
└── styles/
    └── module.css     # styling dei bottoni
```
