# Patch manual para `scripts/architect.js` — cablear ARCH-19 y ARCH-20

> ✅ **Aplicado el 2026-07-31 por el humano** (`architect.js` protegido, no lo pude tocar
> yo) + `DS_RULES` actualizado por el agente. `npm run lint:arch` corre ambas reglas desde
> entonces. Encontró 2 casos reales que fix-079-b no había visto (templates `.html`
> externos, fuera del alcance del audit original que solo miraba `.ts`) — resueltos en
> `fix-081-b-arch20-residual-html-externos`. Este archivo queda como referencia histórica.

Aplicar estos 6 cambios en el editor (el File Protector bloquea Edit/Write/Bash del agente
sobre este archivo — requiere que lo apliques vos). Después de aplicar, correr:

```bash
npm run lint:arch -- --update-ds-baseline
node scripts/lib/class-discipline.test.mjs
node scripts/lib/a11y-guardrails.test.mjs
npm run lint:arch
```

---

## 1. Imports (línea ~32-39)

**Buscar:**
```js
import {
    findAdhocPills,
    findButtonSizeOverrides,
    findArbitraryTextSizes,
    isPillWhitelisted,
    buildBaseline,
    compareWithBaseline,
    DS_RULES,
} from './lib/class-discipline.js';
```

**Reemplazar por:**
```js
import {
    findAdhocPills,
    findButtonSizeOverrides,
    findArbitraryTextSizes,
    findAdhocTypography,
    isPillWhitelisted,
    isTypographyWhitelisted,
    buildBaseline,
    compareWithBaseline,
    DS_RULES,
} from './lib/class-discipline.js';
import { findIconOnlyButtonsWithoutLabel } from './lib/a11y-guardrails.js';
```

---

## 2. Tabla de metadata de reglas (después de ARCH-18, línea ~204)

**Buscar:**
```js
    'ARCH-18': {
        name: 'Alias bare prohibido en @theme',
        doc: 'indices/ANTI-PATTERNS.md (AP-015)',
        fix: 'Si una clase text-X no renderiza, migra los USOS a la forma canónica text-text-X (fix-030). NUNCA agregues un alias --color-X bare al @theme para resucitar la forma corta — eso vuelve a abrir la ambigüedad que fix-030/fix-033 cerraron y deja ciego a ARCH-11.',
    },
};
```

**Reemplazar por:**
```js
    'ARCH-18': {
        name: 'Alias bare prohibido en @theme',
        doc: 'indices/ANTI-PATTERNS.md (AP-015)',
        fix: 'Si una clase text-X no renderiza, migra los USOS a la forma canónica text-text-X (fix-030). NUNCA agregues un alias --color-X bare al @theme para resucitar la forma corta — eso vuelve a abrir la ambigüedad que fix-030/fix-033 cerraron y deja ciego a ARCH-11.',
    },
    'ARCH-19': {
        name: 'Cluster tipográfico ad-hoc (ratchet)',
        doc: 'indices/STYLES.md (§Vocabulario tipográfico) + fix-078-b',
        fix: 'Usa .overline (micro-label uppercase) o .item-title (título de fila/card) en vez de recomponer text-xs/text-sm + font-* + uppercase + tracking-* a mano.',
    },
    'ARCH-20': {
        name: 'Botón icon-only sin nombre accesible',
        doc: 'indices/ANTI-PATTERNS.md + fix-079-b (ASG-b-054)',
        fix: 'Todo <button> que solo contiene <app-icon> (sin texto visible) necesita aria-label describiendo la ACCIÓN ("Eliminar alumno", no "Basurero"). Si ya tiene pTooltip, promové ese mismo texto a aria-label.',
    },
};
```

---

## 3. `dsCounts` — agregar ARCH-19 al mapa de conteo (línea ~262)

**Buscar:**
```js
const dsCounts = {
    'ARCH-15': new Map(),
    'ARCH-16': new Map(),
    'ARCH-17': new Map(),
};
```

**Reemplazar por:**
```js
const dsCounts = {
    'ARCH-15': new Map(),
    'ARCH-16': new Map(),
    'ARCH-17': new Map(),
    'ARCH-19': new Map(),
};
```

---

## 4. `trackClassDiscipline()` — sumar el detector de tipografía (línea ~269-283)

**Buscar:**
```js
function trackClassDiscipline(filePath, content) {
    const rel = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    const add = (rule, count, sample) => {
        if (count === 0) return;
        dsCounts[rule].set(rel, { count, sample });
    };
    if (!isPillWhitelisted(rel)) {
        const pills = findAdhocPills(content);
        add('ARCH-15', pills.length, pills[0]);
    }
    const overrides = findButtonSizeOverrides(content);
    add('ARCH-16', overrides.length, overrides[0] ? `${overrides[0].attr} (→ ${overrides[0].offenders.join(', ')})` : undefined);
    const sizes = findArbitraryTextSizes(content);
    add('ARCH-17', sizes.length, [...new Set(sizes)].join(', '));
}
```

**Reemplazar por:**
```js
function trackClassDiscipline(filePath, content) {
    const rel = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    const add = (rule, count, sample) => {
        if (count === 0) return;
        dsCounts[rule].set(rel, { count, sample });
    };
    if (!isPillWhitelisted(rel)) {
        const pills = findAdhocPills(content);
        add('ARCH-15', pills.length, pills[0]);
    }
    const overrides = findButtonSizeOverrides(content);
    add('ARCH-16', overrides.length, overrides[0] ? `${overrides[0].attr} (→ ${overrides[0].offenders.join(', ')})` : undefined);
    const sizes = findArbitraryTextSizes(content);
    add('ARCH-17', sizes.length, [...new Set(sizes)].join(', '));
    if (!isTypographyWhitelisted(rel)) {
        const clusters = findAdhocTypography(content);
        add('ARCH-19', clusters.length, [...new Set(clusters)].join(', '));
    }
}

/** ARCH-20 — error duro, sin ratchet: la a11y no tiene backlog legítimo que tolerar. */
function checkIconOnlyButtons(filePath, content) {
    const icons = findIconOnlyButtonsWithoutLabel(content);
    for (const icon of icons) {
        reportError(
            'ARCH-20',
            filePath,
            `Botón icon-only (ícono "${icon}") sin nombre accesible (aria-label/title/pButton label).`,
        );
    }
}
```

---

## 5. `DS_RULES` en `scripts/lib/class-discipline.js` (este archivo SÍ lo pude editar yo)

Ya está hecho — cuando apliques este patch, `DS_RULES` seguirá diciendo solo
`['ARCH-15', 'ARCH-16', 'ARCH-17']`. Hace falta que vos (o yo, después de que confirmes
que aplicaste el patch de architect.js) cambie esa línea a:

```js
export const DS_RULES = ['ARCH-15', 'ARCH-16', 'ARCH-17', 'ARCH-19'];
```

Dejo esto sin tocar a propósito — si lo cambio antes de que architect.js esté cableado,
`ARCH-19` aparecería en el reporte con total 0 engañosamente.

---

## 6. Los 2 call-sites — sumar la llamada a `checkIconOnlyButtons`

### 6a. Dentro de `analyzeFile()` (línea ~583-588, después de "Reglas 15/16/17")

**Buscar:**
```js
    // ── Regla 14: acumular íconos usados (template inline + configs icon:) ───
    trackIconUsage(filePath, content);

    // ── Reglas 15/16/17: disciplina de clases del DS (ratchet) ───────────────
    trackClassDiscipline(filePath, content);
}
```
*(este bloque aparece dentro de `analyzeFile`, cerca de la línea 588 — verificar que sea
el que cierra la función que procesa `.ts`, no el de `analyzeTemplate`)*

**Reemplazar por:**
```js
    // ── Regla 14: acumular íconos usados (template inline + configs icon:) ───
    trackIconUsage(filePath, content);

    // ── Reglas 15/16/17/19: disciplina de clases del DS (ratchet) ────────────
    trackClassDiscipline(filePath, content);

    // ── Regla 20: botones icon-only sin nombre accesible (error duro) ────────
    checkIconOnlyButtons(filePath, content);
}
```

### 6b. Dentro de `analyzeTemplate()` (línea ~630-638, el bloque que ya viste)

**Buscar:**
```js
    // ── Regla 11 v2: clases muertas también en templates externos ───────────
    reportDeadTokenClasses(filePath, content);

    // ── Regla 14: acumular íconos usados en templates externos ──────────────
    trackIconUsage(filePath, content);

    // ── Reglas 15/16/17: disciplina de clases del DS (ratchet) ───────────────
    trackClassDiscipline(filePath, content);
}
```

**Reemplazar por:**
```js
    // ── Regla 11 v2: clases muertas también en templates externos ───────────
    reportDeadTokenClasses(filePath, content);

    // ── Regla 14: acumular íconos usados en templates externos ──────────────
    trackIconUsage(filePath, content);

    // ── Reglas 15/16/17/19: disciplina de clases del DS (ratchet) ────────────
    trackClassDiscipline(filePath, content);

    // ── Regla 20: botones icon-only sin nombre accesible (error duro) ────────
    checkIconOnlyButtons(filePath, content);
}
```

---

## Después de aplicar

```bash
npm run lint:arch -- --update-ds-baseline   # crea la cuota ARCH-19 (debería dar ~0, ya migrado en fix-078-b)
npm run lint:arch                            # ARCH-20 debe dar 0 errores (ya resuelto en fix-079-b)
```

Si `ARCH-20` reporta algo > 0, hay un botón icon-only nuevo que se coló — no debería pasar
si este patch se aplica sobre el estado que dejó fix-079-b.

⚠️ **Nota post-mortem:** `findIconOnlyButtonsWithoutLabel` en `a11y-guardrails.js` tuvo que
corregirse durante este mismo track — la primera versión no manejaba botones con ícono
alternado por `@if/@else` (ej. loader vs. ícono real), dejando pasar 2 casos reales sin
que ningún barrido los viera. La versión que este patch consume ya tiene el fix
(`stripControlFlowSyntax` con matching greedy) y 2 tests de regresión para ese caso
específico — no es necesario volver a auditar por esto, ya está cubierto.
