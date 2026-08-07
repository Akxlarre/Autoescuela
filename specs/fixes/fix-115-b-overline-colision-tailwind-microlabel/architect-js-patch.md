# Patch manual para `scripts/architect.js` — cablear ARCH-22 (colisión con utilidad bare de Tailwind)

Mismo motivo que los patches anteriores (fix-079-b ARCH-20, fix-084-b ARCH-21): el File
Protector bloquea Edit/Write/Bash del agente sobre `scripts/architect.js` — requiere que lo
apliques vos en tu editor.

`scripts/lib/tailwind-bare-utilities.js` (detector puro + lista reservada) ya existe y
funciona standalone sin este patch:

```bash
node scripts/lib/tailwind-bare-utilities.test.mjs   # micro-suite, 17/17 casos OK
node scripts/lib/tailwind-bare-utilities.js         # corre contra _variables.scss real → 0 colisiones
```

Este patch solo cablea el check dentro de `npm run lint:arch`, igual que ARCH-19/20/21.

Después de aplicar, correr:

```bash
node scripts/lib/tailwind-bare-utilities.test.mjs
npm run lint:arch
```

---

## 1. Import (después del import de `check-bento-classes.js`, línea ~44)

**Buscar:**
```js
import { extractBentoClasses, diffBentoClasses } from './check-bento-classes.js';
```

**Reemplazar por:**
```js
import { extractBentoClasses, diffBentoClasses } from './check-bento-classes.js';
import { findReservedTailwindClassCollisions } from './lib/tailwind-bare-utilities.js';
```

---

## 2. Tabla de metadata de reglas (bloque `RULES`, ~línea 231 y ~línea 241)

**2a. Corregir el mensaje de ARCH-19** (quedó apuntando al nombre viejo de la clase —
`.overline` fue renombrada a `.micro-label` en este mismo fix, fix-115-b):

**Buscar:**
```js
    'ARCH-19': {
        name: 'Cluster tipográfico ad-hoc (ratchet)',
        doc: 'indices/STYLES.md (§Vocabulario tipográfico) + fix-078-b',
        fix: 'Usa .overline (micro-label uppercase) o .item-title (título de fila/card) en vez de recomponer text-xs/text-sm + font-* + uppercase + tracking-* a mano.',
    },
```

**Reemplazar por:**
```js
    'ARCH-19': {
        name: 'Cluster tipográfico ad-hoc (ratchet)',
        doc: 'indices/STYLES.md (§Vocabulario tipográfico) + fix-078-b',
        fix: 'Usa .micro-label (micro-label uppercase) o .item-title (título de fila/card) en vez de recomponer text-xs/text-sm + font-* + uppercase + tracking-* a mano.',
    },
```

**2b. Agregar la entrada ARCH-22** (después de ARCH-21, que hoy cierra la tabla con `};`):

**Buscar:**
```js
    'ARCH-21': {
        name: 'Clase .bento-* nueva sin revisar',
        doc: 'indices/STYLES.md (§Cómo elegir: bento + botones) + fix-084-b (ASG-b-057)',
        fix: 'Antes de agregar una clase .bento-* nueva a _bento-grid.scss, revisá si alguna de las 34 existentes ya resuelve el caso (ver tabla de decisión). Si es legítima, sumala a scripts/lib/bento-classes.allowlist.json con la justificación.',
    },
};
```

**Reemplazar por:**
```js
    'ARCH-21': {
        name: 'Clase .bento-* nueva sin revisar',
        doc: 'indices/STYLES.md (§Cómo elegir: bento + botones) + fix-084-b (ASG-b-057)',
        fix: 'Antes de agregar una clase .bento-* nueva a _bento-grid.scss, revisá si alguna de las 34 existentes ya resuelve el caso (ver tabla de decisión). Si es legítima, sumala a scripts/lib/bento-classes.allowlist.json con la justificación.',
    },
    'ARCH-22': {
        name: 'Clase del DS colisiona con utilidad bare de Tailwind',
        doc: 'indices/STYLES.md (§Clases Semánticas Globales) + fix-115-b',
        fix: 'El nombre de clase coincide EXACTAMENTE con una utilidad nativa de Tailwind sin sufijo (ej. overline, flex, truncate, container — ver scripts/lib/tailwind-bare-utilities.js). Tailwind genera su propia regla en @layer utilities que se SUMA silenciosamente al estilo del DS (no lo reemplaza), como pasó con .overline → .micro-label. Elegí un nombre compuesto con guion.',
    },
};
```

---

## 3. Función de chequeo (después de `checkBentoClassAllowlist()`, línea ~101)

**Buscar:**
```js
function reportDeadTokenClasses(filePath, content) {
```

**Insertar ANTES de esa línea:**
```js
// ── ARCH-22 (fix-115-b): colisión de nombre con utilidad bare de Tailwind.
// Corre UNA vez contra _variables.scss (no es un check por-archivo), igual que ARCH-18/21. ──
function checkTailwindBareCollisions() {
    const scssPath = path.join(process.cwd(), 'src', 'styles', 'tokens', '_variables.scss');
    let content;
    try {
        content = fs.readFileSync(scssPath, 'utf-8');
    } catch {
        return; // fail-open: si el archivo no existe, otro check ya lo habrá señalado
    }
    const collisions = findReservedTailwindClassCollisions(content);
    for (const cls of collisions) {
        reportError(
            'ARCH-22', scssPath,
            `Clase .${cls} coincide con una utilidad bare reservada de Tailwind — Tailwind generará su propia regla en @layer utilities que se sumará silenciosamente al estilo del DS.`,
        );
    }
}

function reportDeadTokenClasses(filePath, content) {
```

---

## 4. Invocación (junto a las otras llamadas one-shot, línea ~769-771)

**Buscar:**
```js
// ── ARCH-18: auditoría del bridge @theme (una sola vez, no por-archivo) ──────
checkForbiddenThemeAliases();
checkBentoClassAllowlist();
```

**Reemplazar por:**
```js
// ── ARCH-18: auditoría del bridge @theme (una sola vez, no por-archivo) ──────
checkForbiddenThemeAliases();
checkBentoClassAllowlist();
checkTailwindBareCollisions();
```

---

## Después de aplicar

```bash
npm run lint:arch
```

Debería dar `0 errores` (el rename a `.micro-label` ya limpió la única colisión existente).
Para probar que ARCH-22 realmente detecta algo, agregá temporalmente una clase de prueba
tipo `.flex { color: red; }` a `_variables.scss`, confirmá que `lint:arch` falla señalando
`ARCH-22`, y revertí la prueba.
