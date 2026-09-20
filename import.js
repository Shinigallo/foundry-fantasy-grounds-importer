/**
 * FG 5e XML Importer - parsing e mapping degli XML "Export a Character" di Fantasy Grounds
 * nel modello dati del sistema dnd5e (Foundry VTT v13 / dnd5e 4.4.x).
 */

const MODULE_ID = "foundry-fantasy-grounds-importer";
const FLAG_KEY = "managedByFgImporter";
const UPLOAD_DIR = "fg-imports";

/* ------------------------------------------------------------------ */
/*  Tabelle di lookup                                                  */
/* ------------------------------------------------------------------ */

const ABILITY_KEYS = {
  strength: "str", str: "str",
  dexterity: "dex", dex: "dex",
  constitution: "con", con: "con",
  intelligence: "int", int: "int",
  wisdom: "wis", wis: "wis",
  charisma: "cha", cha: "cha"
};

// dnd5e 4.4.x usa chiavi abbreviate per le skill
const SKILL_KEYS = {
  "acrobatics": "acr",
  "animal handling": "ani",
  "arcana": "arc",
  "athletics": "ath",
  "deception": "dec",
  "history": "his",
  "insight": "ins",
  "investigation": "itm",
  "medicine": "inv",
  "nature": "nat",
  "performance": "prc",
  "persuasion": "prf",
  "perception": "per",
  "religion": "rel",
  "sleight of hand": "sle",
  "stealth": "ste",
  "survival": "sur"
};

const SIZE_KEYS = {
  tiny: "tiny", "tin": "tiny",
  small: "sm", sm: "sm", s: "sm",
  medium: "med", med: "med", m: "med",
  large: "lg", lg: "lg", l: "lg",
  huge: "huge", huge: "huge",
  colossal: "grg", gargantuan: "grg", grg: "grg"
};

const DAMAGE_TYPES = new Set([
  "bludgeoning", "slashing", "piercing", "acid", "cold", "fire",
  "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"
]);

const MARTIAL_WEAPONS = new Set([
  "battleaxe", "bolas", "flail", "glaive", "greataxe", "greatclub",
  "greatsword", "halberd", "javelin", "lance", "light hammer", "longsword",
  "maul", "morningstar", "rapier", "spear", "trident",
  "war pick", "warhammer", "whip"
]);

const SIMPLE_WEAPONS = new Set([
  "club", "dagger", "handaxe", "light mace", "quarterstaff",
  "shortsword", "sling", "staff"
]);

const DICE_RE = /(\d*)d(\d+)/i;
const HP_RE = /(\d+)\s*\/\s*(\d+)\s*(\(([^)]*)\))?/;

/* ------------------------------------------------------------------ */
/*  Parser XML                                                         */
/* ------------------------------------------------------------------ */

/** Parser XML completo: ritorna l'array di oggetti <pc> estratti. */
export function parseFgXml(text) {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  const err = doc.querySelector("parsererror");
  if (err) throw new Error(`XML non valido: ${err.textContent.slice(0, 200)}`);

  const root = doc.querySelector("characters");
  if (!root) throw new Error("Tag <characters> non trovato nel file");

  return Array.from(root.querySelectorAll(":scope > pc")).map((pc, i) => {
    const pcData = {
      index: i,
      label: textOf(pc.querySelector("label")),
      name: textOf(pc.querySelector("name")),
      level: intOf(pc.querySelector("level")),
      size: textOf(pc.querySelector("size")),
      init: intOf(pc.querySelector("init")),
      ac: intOf(pc.querySelector("ac")),
      hp: textOf(pc.querySelector("hp")),
      speed: textOf(pc.querySelector("speed")),
      abilities: {},
      saves: [],
      skills: [],
      actions: [],
      portrait: textOf(pc.querySelector("portrait")) || null
    };

    for (const key of Object.keys(ABILITY_KEYS)) {
      const el = pc.querySelector(`:scope > ${key}`);
      const v = intOf(el);
      if (v !== null) pcData.abilities[ABILITY_KEYS[key]] = v;
    }

    pc.querySelectorAll(":scope > save").forEach(el => pcData.saves.push(textOf(el)));
    pc.querySelectorAll(":scope > skill").forEach(el => pcData.skills.push(textOf(el)));
    pc.querySelectorAll(":scope > action").forEach(el => pcData.actions.push({
      name: textOf(el.querySelector("name")),
      text: textOf(el.querySelector("text")),
      attack: textOf(el.querySelector("attack"))
    }));

    if (!pcData.label && !pcData.name) throw new Error(`<pc> senza nome (elemento ${i + 1})`);
    return pcData;
  });
}

function textOf(el) { return el ? (el.textContent || "").trim() : ""; }
function intOf(el) {
  const t = textOf(el);
  if (!t) return null;
  const n = parseInt(t.replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/** "59/59 (4d8+3d8)" -> { current, max, hitDice } */
function parseHp(hp) {
  const m = (hp || "").match(HP_RE);
  if (!m) return { current: null, max: null, hitDice: null };
  return { current: +m[1], max: +m[2], hitDice: m[4] || null };
}

/** "35 ft." -> 35 */
function parseSpeed(s) {
  const m = (s || "").match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

/**
 * "Halfling, Ghostwise Druid 4/Monk 3"
 * -> { race: "Halfling", subrace: "Ghostwise", classes: [{name:"Druid",level:4},{name:"Monk",level:3}] }
 */
function parseNameLine(name) {
  const out = { race: "", subrace: "", classes: [] };
  if (!name) return out;

  const comma = name.indexOf(",");
  let rest = name;
  if (comma >= 0) {
    out.race = name.slice(0, comma).trim();
    rest = name.slice(comma + 1).trim();
  }

  const classRe = /([A-Z][a-zA-Z&']+)\s+(\d+)(?=\s*\/|\s*$)/g;
  let m;
  const consumed = [];
  while ((m = classRe.exec(rest))) {
    out.classes.push({ name: m[1], level: parseInt(m[2], 10) });
    consumed.push(m[0]);
  }
  let leftover = rest;
  for (const c of consumed) leftover = leftover.replace(c, " ");
  leftover = leftover.replace(/[\/\s]+/g, " ").trim();

  if (out.race && leftover) out.subrace = leftover;
  else if (!out.race) out.race = leftover;
  return out;
}

/**
 * "|+6|1d6+3" + "Hit: 1d6 + 3 bludgeoning damage."
 * -> { bonus: 6, damage: {number:1, denomination:6, bonus:3, types:["bludgeoning"]} }
 */
function parseAction(action) {
  const parts = (action.attack || "").split("|").map(s => s.trim()).filter(Boolean);
  const bonus = parts.length ? (parseInt(parts[0], 10) || 0) : null;
  const damage = parts.length > 1 ? parseDice(parts[1]) : parseDiceFromText(action.text);
  const type = parseDamageType(action.text);
  if (type) damage.types = [type];
  return { bonus, damage, name: action.name, text: action.text };
}

/** "1d6+3" -> {number, denomination, bonus} */
function parseDice(s) {
  const m = (s || "").match(DICE_RE);
  const out = { number: 1, denomination: 6, bonus: null };
  if (m) {
    out.number = m[1] ? parseInt(m[1], 10) : 1;
    out.denomination = parseInt(m[2], 10);
    const tail = (s || "").slice((m.index || 0) + m[0].length).match(/[+-]\s*\d+/);
    if (tail) out.bonus = parseInt(tail[0].replace(/[^0-9-]/g, ""), 10);
  }
  return out;
}

function parseDiceFromText(text) {
  const m = (text || "").match(/Hit:?\s*(\d*d\d+)/i);
  return m ? parseDice(m[1]) : { number: 1, denomination: 6, bonus: null };
}

function parseDamageType(text) {
  const m = (text || "").match(/([a-z]+)\s+damage/i);
  if (!m) return null;
  const t = m[1].toLowerCase();
  return DAMAGE_TYPES.has(t) ? t : null;
}

/** Classifica il weapon: "natural", "martialM", "simpleM" */
function guessWeaponType(name) {
  const n = (name || "").toLowerCase();
  if (/(fist|unarmed|claw|beak|tail)/.test(n)) return { value: "natural", classification: "unarmed" };
  if (SIMPLE_WEAPONS.has(n)) return { value: "simpleM", classification: "weapon" };
  if (MARTIAL_WEAPONS.has(n)) return { value: "martialM", classification: "weapon" };
  return { value: "simpleM", classification: "weapon" };
}

/* ------------------------------------------------------------------ */
/*  Costruzione del payload dnd5e                                      */
/* ------------------------------------------------------------------ */

/** Costruisce l'oggetto actor (o la patch di update) a partire dai dati del <pc>. */
export function buildActorData(pc) {
  const hp = parseHp(pc.hp);
  const parsed = parseNameLine(pc.name);

  const abilities = {};
  for (const [k, v] of Object.entries(pc.abilities)) {
    abilities[k] = { value: v, proficient: 0 };
  }

  // Saving throw: in dnd5e 4.4.x la prof di save vive su abilities.<k>.proficient
  for (const s of pc.saves) {
    const key = ABILITY_KEYS[s.split(/\s+/)[0].toLowerCase()];
    if (key) abilities[key] = { ...(abilities[key] || { value: 10 }), proficient: 1 };
  }

  const skills = {};
  for (const s of pc.skills) {
    const key = SKILL_KEYS[s.replace(/\s*\+\d+$/, "").trim().toLowerCase()];
    if (key) skills[key] = { value: 1 };
  }

  const items = [];

  // Razza
  if (parsed.race) {
    items.push({
      name: parsed.subrace ? `${parsed.race} (${parsed.subrace})` : parsed.race,
      type: "race",
      system: { subtype: parsed.subrace || "" },
      flags: { [MODULE_ID]: { [FLAG_KEY]: true } }
    });
  }

  // Classi
  const totalLevel = parsed.classes.reduce((t, c) => t + c.level, 0);
  for (const c of parsed.classes) {
    items.push({
      name: c.name,
      type: "class",
      system: { levels: c.level, hd: { denomination: hitDieFor(c.name) } },
      flags: { [MODULE_ID]: { [FLAG_KEY]: true } }
    });
  }

  // Azioni -> armi
  for (const a of pc.actions) {
    const parsedAction = parseAction(a);
    const wt = guessWeaponType(a.name);
    const isUnarmed = wt.classification === "unarmed";
    items.push({
      name: a.name || "Action",
      type: "weapon",
      system: {
        type: { value: wt.value },
        equipped: true,
        proficient: 1,
        range: { value: 5 },
        damage: { base: { ...parsedAction.damage, types: parsedAction.damage.types || [] } },
        description: { value: a.text || "" },
        activities: {
          [foundry.utils.randomID()]: {
            type: "attack",
            name: "",
            sort: 0,
            attack: {
              ability: isUnarmed ? "con" : "str",
              bonus: parsedAction.bonus !== null ? String(parsedAction.bonus) : "",
              critical: { threshold: 20 },
              flat: false,
              type: { value: "melee", classification: wt.classification }
            },
            damage: { critical: { bonus: "" }, includeBase: true, parts: [] }
          }
        }
      },
      flags: { [MODULE_ID]: { [FLAG_KEY]: true } }
    });
  }

  const level = pc.level ?? (totalLevel || null);

  const system = {
    abilities,
    attributes: {
      ac: pc.ac !== null ? { calc: "flat", flat: pc.ac } : undefined,
      hp: hp.max !== null ? { value: hp.current ?? hp.max, max: hp.max } : undefined,
      movement: { walk: parseSpeed(pc.speed) ?? undefined },
      init: pc.init !== null ? { ability: "", bonus: String(pc.init) } : undefined
    },
    skills,
    traits: { size: SIZE_KEYS[(pc.size || "").toLowerCase()] },
    details: {
      level: level ?? undefined,
      race: parsed.race ? (parsed.subrace ? `${parsed.race} (${parsed.subrace})` : parsed.race) : ""
    }
  };

  return { system, items };
}

function hitDieFor(className) {
  const n = (className || "").toLowerCase();
  if (/(fighter|paladin)/.test(n)) return "d10";
  if (/(barbarian|ranger|rogue)/.test(n)) return "d12";
  if (/(bard|cleric|druid|monk)/.test(n)) return "d8";
  return "d6";
}

/** Estrae il ritratto base64 come data URL (con tipo mime corretto). */
function portraitToDataUrl(b64) {
  if (!b64) return null;
  const clean = b64.replace(/\s+/g, "");
  if (clean.startsWith("/9j/")) return `data:image/jpeg;base64,${clean}`;
  if (clean.startsWith("iVBOR")) return `data:image/png;base64,${clean}`;
  return null;
}

/**
 * Trova (e se necessario crea) l'actor di destinazione per questo <pc>.
 * Ritorna l'actor creato/aggiornato e una lista di item da eliminare (già gestita dentro).
 */
async function importPc(pc, targetActor = null) {
  const { system, items } = buildActorData(pc);

  // Ritratto: se presente, lo salviamo nel data folder (come nel 5e Companion Importer)
  const dataUrl = portraitToDataUrl(pc.portrait);
  let img = null;
  if (dataUrl) {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const safeName = (pc.label || "character").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
      const file = new File([blob], `${safeName}.jpg`, { type: blob.type || "image/jpeg" });
      const FilePicker = globalThis.FilePicker ?? foundry.applications?.FilePicker ?? foundry.applications?.apps?.FilePicker;
      if (FilePicker?.createDirectory && FilePicker?.upload) {
        await FilePicker.createDirectory("data", UPLOAD_DIR);
        const result = await FilePicker.upload("data", UPLOAD_DIR, file);
        if (result?.name) img = `data/${UPLOAD_DIR}/${result.name}`;
      }
    } catch (e) {
      console.warn("[FG 5e XML Importer] upload ritratto fallito, uso data URL", e);
      img = dataUrl;
    }
  }

  if (targetActor) {
    // Update: rimuoviamo solo gli item marcati dal moduli e aggiorniamo i campi
    const managed = targetActor.items.filter(i => i.getFlag(MODULE_ID, FLAG_KEY)).map(i => i.id);
    if (managed.length) await targetActor.deleteEmbeddedDocuments("Item", managed);
    const patch = { system };
    if (img) patch.img = img;
    await targetActor.update(patch);
    if (items.length) await targetActor.createEmbeddedDocuments("Item", items);
    return targetActor;
  }

  const actorData = {
    name: pc.label || pc.name || "New Character",
    type: "character",
    img: img ?? undefined,
    system,
    items,
    folder: undefined
  };
  return game.actors.create(actorData);
}

/** Importa tutti i <pc> del file. Ritorna { created: [actors] }. */
export async function importFile(text, targetActor = null) {
  const pcs = parseFgXml(text);
  if (!pcs.length) throw new Error("Nessun personaggio trovato nel file");
  const created = [];
  for (const pc of pcs) {
    const actor = await importPc(pc, created.length === 0 ? targetActor : null);
    if (actor) created.push(actor);
  }
  return { created };
}
