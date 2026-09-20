import { importFile } from "./import.js";

console.log("Fantasy Grounds Importer | Initializing");

/* ------------------------------------------------------------------ */
/*  Verifiche                                                          */
/* ------------------------------------------------------------------ */

function canImport() {
  if (!game.user?.isGM) {
    ui.notifications.warn("Solo il GM può importare XML di Fantasy Grounds.");
    return false;
  }
  if (game.system.id !== "dnd5e") {
    ui.notifications.warn("Questo modulo funziona solo con il sistema dnd5e.");
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/*  Dialog di importazione                                             */
/* ------------------------------------------------------------------ */

function openImportDialog(targetActor = null) {
  if (!canImport()) return;

  const content = `
    <div style="padding: 10px;">
      <p>Seleziona un file XML esportato da Fantasy Grounds ("Export a Character", formato <code>&lt;characters version="5"&gt;</code>).</p>
      <p><small>Ogni <code>&lt;pc&gt;</code> nel file crea un actor separato.${targetActor ? " Con questo pulsante viene aggiornato l'actor aperto." : ""}</small></p>
      <div class="form-group">
        <label>File:</label>
        <input type="file" id="fg-xml-upload" accept=".xml,text/xml,application/xml" style="width: 100%;">
      </div>
    </div>`;

  new Dialog({
    title: "FG 5e XML Importer",
    content,
    buttons: {
      import: {
        icon: '<i class="fa-solid fa-file-import"></i>',
        label: "Importa",
        callback: async (html) => {
          const fileInput = html.find("#fg-xml-upload")[0];
          if (!fileInput?.files?.length) {
            ui.notifications.error("Nessun file selezionato.");
            return;
          }
          await processFile(fileInput.files[0], targetActor);
        }
      }
    },
    default: "import"
  }).render(true);
}

async function processFile(file, targetActor = null) {
  const name = file.name;
  try {
    const text = await file.text();
    const { created } = await importFile(text, targetActor);
    if (targetActor) {
      ui.notifications.info(`Importato in "${targetActor.name}" da ${name}.`);
    } else if (created.length > 1) {
      ui.notifications.info(`Creati ${created.length} actor da ${name}.`);
    } else if (created.length === 1) {
      ui.notifications.info(`Creato "${created[0].name}" da ${name}.`);
      created[0].sheet?.render?.(true);
    }
  } catch (err) {
    console.error("[FG 5e XML Importer] Errore di importazione:", err);
    ui.notifications.error(`Errore di importazione: ${err.message}`);
  }
}

/* ------------------------------------------------------------------ */
/*  UI: bottoni e hotkey                                               */
/* ------------------------------------------------------------------ */

Hooks.once("ready", () => {
  // Hotkey F9 (solo quando non si sta scrivendo in un campo di testo)
  window.addEventListener("keydown", (event) => {
    if (event.code !== "F9" || event.ctrlKey || event.altKey || event.metaKey) return;
    const t = event.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    event.preventDefault();
    openImportDialog();
  });
});

// Pulsante nella sidebar della lista attori (Foundry v12: html è jQuery)
Hooks.on("renderActorDirectory", (app, html) => {
  const button = $(
    `<button class="import-fg-xml" title="Importa XML di Fantasy Grounds"><i class="fa-solid fa-file-import"></i> Import FG XML</button>`
  );
  button.on("click", () => openImportDialog());
  html.find(".directory-footer").append(button);
});

// Pulsante nell'header della scheda actor (hook del sistema dnd5e 3.x)
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  if (sheet.actor.type !== "character") return;
  buttons.unshift({
    label: "Import FG XML",
    class: "import-fg-xml",
    icon: "fas fa-file-import",
    onclick: () => openImportDialog(sheet.actor)
  });
});
