# Patch manual para `scripts/architect.js` — cablear ARCH-21 (check-bento-classes)

> ✅ **Aplicado el 2026-07-31 por el humano.** `npm run lint:arch` corre ARCH-21 desde
> entonces — verificado agregando una clase `.bento-*` de prueba a `_bento-grid.scss`
> (detectada correctamente, exit con error) y revirtiendo (vuelve a 0 errores). Este
> archivo queda como referencia histórica.

Opcional — `check-bento-classes.js` funciona standalone (`node scripts/check-bento-classes.js`)
sin este patch. Aplicar solo si querés que el freno contra clases `.bento-*` nuevas corra
automático dentro de `npm run lint:arch`, igual que ARCH-19/20.

Mismo motivo que las veces anteriores: el File Protector bloquea Edit/Write/Bash del agente
sobre este archivo específico — requiere que lo apliques vos en tu editor. Después de
aplicar, correr:

```bash
node scripts/lib/bento-classes.test.mjs
npm run lint:arch
```

---

## 1. Import (después del import de `a11y-guardrails.js`, línea ~40)

**Buscar:**
```js
import { findIconOnlyButtonsWithoutLabel } from './lib/a11y-guardrails.js';
```

**Reemplazar por:**
```js
import { findIconOnlyButtonsWithoutLabel } from './lib/a11y-guardrails.js';
import { extractBentoClasses, diffBentoClasses } from './check-bento-classes.js';
```

---

## 2. Tabla de metadata de reglas (después de ARCH-20, en la tabla `RULES`)

**Buscar** (el bloque que agregaste en el patch anterior):
```js
    'ARCH-20': {
        name: 'Botón icon-only sin nombre accesible',
        doc: 'indices/ANTI-PATTERNS.md + fix-079-b (ASG-b-054)',
        fix: 'Todo <button> que solo contiene <app-icon> (sin texto visible) necesita aria-label describiendo la ACCIÓN ("Eliminar alumno", no "Basurero"). Si ya tiene pTooltip, promové ese mismo texto a aria-label.',
    },
};
```

**Reemplazar por:**
```js
    'ARCH-20': {
        name: 'Botón icon-only sin nombre accesible',
        doc: 'indices/ANTI-PATTERNS.md + fix-079-b (ASG-b-054)',
        fix: 'Todo <button> que solo contiene <app-icon> (sin texto visible) necesita aria-label describiendo la ACCIÓN ("Eliminar alumno", no "Basurero"). Si ya tiene pTooltip, promové ese mismo texto a aria-label.',
    },
    'ARCH-21': {
        name: 'Clase .bento-* nueva sin revisar',
        doc: 'indices/STYLES.md (§Cómo elegir: bento + botones) + fix-084-b (ASG-b-057)',
        fix: 'Antes de agregar una clase .bento-* nueva a _bento-grid.scss, revisá si alguna de las 34 existentes ya resuelve el caso (ver tabla de decisión). Si es legítima, sumala a scripts/lib/bento-classes.allowlist.json con la justificación.',
    },
};
```

---

## 3. Función de chequeo (después de `checkForbiddenThemeAliases()`, línea ~79)

**Buscar:**
```js
function reportDeadTokenClasses(filePath, content) {
```

**Insertar ANTES de esa línea:**
```js
// ── ARCH-21 (fix-084-b): freno contra clases .bento-* nuevas sin revisión.
// Corre UNA vez contra _bento-grid.scss (no es un check por-archivo), igual que ARCH-18. ──
function checkBentoClassAllowlist() {
    const scssPath = path.join(process.cwd(), 'src', 'styles', 'layout', '_bento-grid.scss');
    const allowlistPath = path.join(process.cwd(), 'scripts', 'lib', 'bento-classes.allowlist.json');
    let scssContent, allowlistJson;
    try {
        scssContent = fs.readFileSync(scssPath, 'utf-8');
        allowlistJson = JSON.parse(fs.readFileSync(allowlistPath, 'utf-8'));
    } catch {
        return; // fail-open: si algún archivo no existe, no bloqueamos el resto del lint
    }
    const current = extractBentoClasses(scssContent);
    const { newClasses } = diffBentoClasses(current, allowlistJson.classes);
    for (const cls of newClasses) {
        reportError(
            'ARCH-21', scssPath,
            `Clase .${cls} nueva en _bento-grid.scss, no está en el allowlist revisado.`,
        );
    }
}

function reportDeadTokenClasses(filePath, content) {
```

---

## 4. Invocación (junto a las otras llamadas one-shot, línea ~742-748)

**Buscar:**
```js
checkForbiddenThemeAliases();
```

**Reemplazar por:**
```js
checkForbiddenThemeAliases();
checkBentoClassAllowlist();
```

---

## Después de aplicar

```bash
npm run lint:arch
```

Debería dar `0 errores` (el allowlist ya tiene las 34 clases actuales). Si agregás una
clase `.bento-*` nueva a `_bento-grid.scss` sin sumarla al allowlist, `ARCH-21` debe
fallar — probalo agregando una clase de prueba y confirmando que el lint la detecta,
después revertí la prueba.
