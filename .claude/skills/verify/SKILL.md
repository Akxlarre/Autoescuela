---
name: verify
description: >
  Verificación visual en navegador real (Playwright MCP). Activar al implementar o modificar
  un componente Angular, resolver un fix visual, o antes de cerrar un track SDD con ACs de UI.
  Confirma renderizado real, consola limpia, red sin 4xx, datos reales (no mock),
  contrato app-like (fill-screen), modo oscuro/claro y responsive.
  Requiere ng serve activo en localhost:4200.
user-invocable: true
allowed-tools: Read, Glob, Grep, Bash, mcp__playwright__browser_navigate, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_console_messages, mcp__playwright__browser_network_requests, mcp__playwright__browser_network_request, mcp__playwright__browser_snapshot, mcp__playwright__browser_find, mcp__playwright__browser_evaluate, mcp__playwright__browser_resize, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_fill_form, mcp__playwright__browser_press_key, mcp__playwright__browser_wait_for, mcp__playwright__browser_hover, mcp__playwright__browser_tabs
---

# Skill: Verificación Visual (Playwright MCP)

El agente **tiene ojos**. Este skill define cómo usarlos sin desperdiciarlos.

## Principio rector

> **QA geométrico ≠ mirada humana.** (spec 0030)

En la spec 0030 se cerró una página con **13/13 ACs verdes** y el owner la rechazó **dos veces**
por cómo se veía. Los probes automáticos de este skill detectan **fallas**, no certifican
**calidad**. La captura hay que **mirarla** y emitir un juicio en prosa. Un reporte que solo
tiene checkboxes verdes es un reporte incompleto.

## Prerequisitos

⚠️ El **Bash Guard** de este proyecto bloquea `curl`/`wget`. Comprobar el puerto con PowerShell:

```powershell
if (Get-NetTCPConnection -LocalPort 4200 -State Listen -EA SilentlyContinue) { "UP" } else { "DOWN" }
```

Si está `DOWN`, pedir al usuario que lance `ng serve` (no lanzarlo tú en foreground).

**Gotcha de perfil bloqueado** (`indices/FLOWS-QA-AUDIT.md`) — síntoma: `browser_navigate`
responde `Browser is already in use for ...\mcp-chrome-<hash>`. El browser MCP quedó huérfano
de una sesión anterior. Matarlo y reintentar.

El perfil viaja en `--user-data-dir`, **no** en `.Path` del proceso — hay que filtrar por
`CommandLine` (verificado; `Get-Process | Where Path -like '*mcp-chrome*'` no matchea nada):

```powershell
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
  Where-Object { $_.CommandLine -like '*mcp-chrome*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

Solo mata el Chrome del perfil MCP; el Chrome personal del usuario queda intacto.

---

## Cheat-sheet de API (firmas REALES)

⚠️ Estas son las firmas verificadas del MCP. **No inventar parámetros** — el server las rechaza.

| Acción | Llamada correcta |
|---|---|
| Navegar | `browser_navigate({ url })` |
| Esperar texto | `browser_wait_for({ text: "Alumnos" })` |
| Esperar tiempo | `browser_wait_for({ time: 1.5 })` — **segundos**, no ms |
| Captura | `browser_take_screenshot({ filename: "x.png", type: "png", scale: "css" })` — `type` y `scale` son **requeridos** |
| Consola | `browser_console_messages({ level: "warning" })` — `level` es **requerido** |
| Ejecutar JS | `browser_evaluate({ function: "() => { ... return x; }" })` — es `function`, **no** `script` |
| Red | `browser_network_requests({ static: false })` |
| Buscar en a11y tree | `browser_find({ text: "..." })` — más barato que `browser_snapshot` completo |
| Redimensionar | `browser_resize({ width, height })` |

`browser_evaluate` **retorna** el valor de la función — no hace falta `console.log`,
usar `return`.

---

## Login (obligatorio para todo lo bajo `/app/**`)

Las credenciales de prueba están **visibles en el pie de `/login`** en dev (spec 0029):

| Cuenta | Rol |
|---|---|
| `admin@test.com` | admin |
| `secretaria@test.com` / `secretaria2@test.com` | secretaria (sedes distintas) |
| `instructor@test.com` | instructor |
| `alumno@test.com` | alumno |

Contraseña única: `Test123456`

### Paso 0 — Limpiar sesión previa (imprescindible)

Si ya hay sesión activa, `browser_navigate` a `/login` **rebota al dashboard del rol anterior**
(el guard redirige) y terminas verificando la página equivocada sin darte cuenta:

```
browser_evaluate({ function: `() => {
  const k = Object.keys(localStorage).filter(x => x.startsWith('sb-'));
  k.forEach(x => localStorage.removeItem(x));
  return { cleared: k };
}` })
browser_navigate({ url: "http://localhost:4200/login" })
```

### Paso 1 — Llenar y enviar

⚠️ Los campos **no** son `input[type=email]` / `input[type=password]` (son PrimeNG).
Los selectores CSS fallan. Localizar por **nombre accesible** — sacar los `ref` con
`browser_find({ regex: "/textbox|Iniciar/i" })` y pasarlos como `target`:

```
browser_fill_form({ fields: [
  { target: "<ref>", name: "Correo electrónico", type: "textbox", value: "admin@test.com" },
  { target: "<ref>", name: "Contraseña",         type: "textbox", value: "Test123456" }
]})
browser_click({ target: "<ref>", element: "Botón Iniciar Sesión" })
browser_wait_for({ time: 2 })
```

Confirmar que la URL resultante es el dashboard del rol esperado antes de seguir.

### ⚠️ Gotcha: preferir navegación SPA sobre `browser_navigate`

Una vez autenticado, ir a otra ruta de `/app/**` con `browser_navigate` fuerza un full page
reload y puede **perder la sesión** por timing de hidratación de Supabase, devolviéndote a
`/login`. Peleado en spec 0029.

Es **intermitente**, no determinista: depende del checkbox "Mantener sesión iniciada" (viene
marcado por defecto) y del timing. En una verificación de este skill el `browser_navigate`
directo sí mantuvo la sesión.

Por eso: **navegar por el menú/sidebar** (`browser_find` + `browser_click`) es lo confiable.
Si usas `browser_navigate`, **comprobar siempre la URL resultante** — un rebote silencioso a
`/login` o al dashboard de otro rol te deja verificando la página equivocada.

---

## Protocolo (3 fases)

### Fase A — Renderizar y MIRAR

```
browser_resize({ width: 1280, height: 800 })
browser_wait_for({ time: 1.5 })     // dejar terminar el reveal GSAP
browser_take_screenshot({ filename: "verify-light.png", type: "png", scale: "css" })
```

Mirar la captura y responder **en prosa**, no con checkboxes:

- ¿El componente objetivo está ahí, con **datos reales** (no skeleton, no vacío)?
- ¿Quién es el **protagonista** visual de la página? ¿Es el que debería serlo?
- ¿Se siente **apretado**? Si sí → revisar **jerarquía y ancho de paneles ANTES** de tocar
  tamaños de fuente (lección spec 0030).
- ¿La jerarquía la dicta el **ancho**, o alguien intentó lograrla agrandando tipografías?

### Fase B — Probes automáticos

Solo lo que **únicamente un navegador puede probar**. Ver "Qué NO verificar aquí" más abajo.

### Fase C — Veredicto

Emitir el reporte del final, incluyendo el bloque **Mirada humana** en prosa.

---

## Probes

### 1 — Consola: Zero Error Policy

```
browser_console_messages({ level: "warning" })
```

Tolerancia cero a `error`. Ignorar ruido de `[vite]`, HMR y warnings dev-mode de Angular sin stack.

### 2 — Red: fallos y RLS

```
browser_network_requests({ static: false })
```

Buscar:
- **4xx/5xx** contra `*.supabase.co` → query rota o **policy RLS faltante** (`403`/`401`).
- **0 requests a Supabase** en una página que debería traer datos → sospechar mock hardcodeado.

Para el body de una falla: `browser_network_request({ index: N, part: "response-body" })`.

### 3 — Datos mock colados a producción

Hallazgo H-016 (`indices/FLOWS-QA-AUDIT.md`): el portal instructor tenía `useMock = true` hardcodeado
y renderizaba perfecto — invisible para cualquier check de DOM.

```
browser_evaluate({ function: `() => {
  const perf = performance.getEntriesByType('resource')
    .filter(r => r.name.includes('supabase.co'));
  return { supabaseRequests: perf.length, urls: perf.slice(0, 5).map(r => r.name) };
}` })
```

Si la página muestra listados pero `supabaseRequests === 0` → **investigar el facade**, no celebrar.

### 4 — Clases que NO generan CSS (solo detectable en runtime)

Caza dos bugs reales del proyecto: los tokens cortos muertos (`text-primary`, fix-030) y el
**purge de `@utility` de Tailwind v4** por concatenación dinámica de clase (fix-036).
`lint:arch` (ARCH-11) lo aproxima estáticamente; el navegador lo **prueba**.

⚠️ **El descenso recursivo es obligatorio.** Tailwind v4 emite las utilities dentro de
`@layer utilities { … }` y los breakpoints dentro de `@media`. Un loop que solo lee
`sheet.cssRules[i].selectorText` de primer nivel ve **229** clases en vez de **1545** y reporta
`flex`, `p-4` y `text-sm` como muertas. Verificado en vivo — no "optimizar" quitando el `walk`.

```
browser_evaluate({ function: `() => {
  const used = new Set();
  document.querySelectorAll('*').forEach(el => el.classList.forEach(c => used.add(c)));
  const defined = new Set();
  const walk = (rules) => {
    for (const r of rules) {
      if (r.selectorText) {
        for (const m of r.selectorText.matchAll(/\.((?:\\.|[\w-])+)/g)) {
          defined.add(m[1].replace(/\\/g, ''));
        }
      }
      if (r.cssRules) walk(r.cssRules);   // @layer / @media / @supports
    }
  };
  for (const sheet of document.styleSheets) {
    try { walk(sheet.cssRules); } catch { continue; }
  }
  const IGNORE = /^(lucide|p-component|p-ripple|p-toast|ng-|cdk-|_nghost|_ngcontent)/;
  return {
    usedCount: used.size,
    definedCount: defined.size,
    dead: [...used].filter(c => !defined.has(c) && !IGNORE.test(c)).sort()
  };
}` })
```

**Sanity check del propio probe:** si `definedCount` sale en el orden de las centenas bajas
(~200) en vez de **>1000**, el `walk` no está descendiendo y el resultado es basura.

Todo lo que salga en `dead` es **una clase escrita en el template que no pinta nada**.
Confirmar cada hallazgo con grep antes de reportarlo:

```bash
grep -rlF ".NOMBRE-CLASE" src/styles/   # 0 archivos ⇒ positivo real
```

`IGNORE` cubre marcadores semánticos sin estilo (`lucide-*`) y clases que PrimeNG inyecta en
runtime. No ampliarlo para silenciar hallazgos legítimos del design system.

### 5 — Contrato app-like (solo si la página usa fill-screen)

Ver `.claude/rules/visual-system.md` § _Patrón App-like_. Correr **a 1280×800**:

```
browser_evaluate({ function: `() => {
  const grid = document.querySelector('[class*="bento-grid--fill-screen"]');
  if (!grid) return { applies: false };
  const doc = document.documentElement;
  return {
    applies: true,
    variant: [...grid.classList].find(c => c.startsWith('bento-grid--fill-screen')),
    documentScrolls: doc.scrollHeight > doc.clientHeight + 1,   // debe ser false en lg+
    fills: [...document.querySelectorAll('.bento-fill')].map(el => ({
      cls: el.className.slice(0, 60),
      scrollsInternally: el.scrollHeight > el.clientHeight + 1,
      contain: getComputedStyle(el).contain
    })),
    inlineContainViolation: [...document.querySelectorAll('.bento-fill[style]')]
      .filter(el => /contain|min-height/i.test(el.getAttribute('style'))).length
  };
}` })
```

**Falla si:** `documentScrolls === true` en desktop (el documento no debe scrollear),
o `inlineContainViolation > 0` (el canon vive en `.bento-fill`, **prohibido** inline — spec 0028).

Luego verificar el **switch por contenedor, no por viewport**: si la página tiene drawer/panel
lateral, abrirlo y confirmar que las columnas **se apilan** aunque el viewport siga en lg
(spec 0030 — usar `isDesktopLayout()`, nunca `lg:` de Tailwind).

### 6 — Overflow horizontal y hover recortado

```
browser_evaluate({ function: `() => {
  const doc = document.documentElement;
  const overflowX = doc.scrollWidth > doc.clientWidth + 1;
  // fix-045: un ancestro con overflow-hidden recorta el glow de [appCardHover]
  const clipped = [...document.querySelectorAll('[appcardhover], [ng-reflect-app-card-hover]')]
    .filter(el => el.closest('.bento-fill'))
    .filter(el => {
      let p = el.parentElement;
      while (p && p !== document.body) {
        if (getComputedStyle(p).overflow !== 'visible') return true;
        p = p.parentElement;
      }
      return false;
    }).length;
  return { overflowX, cardHoverClipped: clipped };
}` })
```

### 7 — Modo oscuro

```
browser_evaluate({ function: "() => document.documentElement.setAttribute('data-mode','dark')" })
browser_wait_for({ time: 0.5 })
browser_take_screenshot({ filename: "verify-dark.png", type: "png", scale: "css" })
```

Mirar contraste real (texto sobre superficie, badges, estados danger/neutral — fix-031).
Re-correr el **probe 4** en oscuro: hay clases que solo existen en un modo.

Restaurar: `browser_evaluate({ function: "() => document.documentElement.removeAttribute('data-mode')" })`

### 8 — Responsive

```
browser_resize({ width: 375, height: 812 })
browser_wait_for({ time: 0.5 })
browser_take_screenshot({ filename: "verify-mobile.png", type: "png", scale: "css" })
browser_resize({ width: 1280, height: 800 })   // restaurar SIEMPRE
```

En móvil el scroll nativo **debe** volver (`documentScrolls === true` es correcto aquí).

---

## Qué NO verificar aquí

Estos ya los cubre `npm run lint:arch` de forma estática, más rápida y exhaustiva.
Duplicarlos en el navegador gasta ciclos y da falsos negativos (solo ve el DOM montado):

| Check | Dueño |
|---|---|
| Colores hardcodeados / tokens inválidos | ARCH-18 + `theme-tokens.js` |
| Íconos sin registrar en `provideIcons()` | ARCH-14 + `icon-registry.js` |
| Emojis, `*ngIf`, `@Input()`, Supabase en UI | Architect Guard (hook) |
| Esquema SQL vs `indices/DATABASE.md` | `sql-schema.js` |

**Excepción — clases muertas (probe 4): NO delegar.** ARCH-11 / `class-discipline.js` trabaja
sobre un baseline y **tiene puntos ciegos comprobados**: al validar este skill, el probe de
runtime encontró `alert-error`, `duration-normal`, `shell-container` y `md:text-plus-4xl` — las
cuatro usadas en templates, con cero reglas CSS, y **ninguna** presente en
`class-discipline.baseline.json`. El linter estático y el probe de runtime son complementarios,
no redundantes.

**Correr `npm run lint:arch` ANTES de abrir el navegador.** Si falla, arreglar eso primero:
verificar visualmente código que el linter rechaza es trabajo perdido.

---

## Cuándo ejecutar

| Situación | Obligatorio |
|---|---|
| Nuevo componente en `shared/` | ✅ |
| Nuevo Smart Component en `features/` | ✅ |
| Fix track con cambios visuales | ✅ |
| Rollout app-like / cambio de layout | ✅ (probes 5 y 6 son el punto) |
| `/spec-verify` con ACs de UI | ✅ |
| Cambios en `src/styles/` | ✅ (probe 4 en claro **y** oscuro) |
| Solo lógica pura (`core/utils/`) | ❌ |
| Solo migración SQL | ❌ |

---

## Formato de Reporte

```
## Verificación Visual — [Página / Componente]

**Ruta:** /app/... · **Rol:** admin · **Viewport:** 1280×800

### Mirada humana
[2-4 frases en PROSA. Quién es el protagonista visual. Si se siente apretado o
desbalanceado. Si la jerarquía la dicta el ancho o alguien la forzó con tipografías.
Esta sección NO puede ser una lista de checkboxes.]

### Probes
| Probe | Resultado |
|---|---|
| Consola | ✅ limpia / ❌ N errores |
| Red | ✅ sin 4xx / ❌ 403 en `<tabla>` (RLS) |
| Datos reales | ✅ N requests a Supabase / ❌ 0 → posible mock |
| Clases sin CSS | ✅ ninguna / ❌ `[lista]` |
| App-like | ✅ doc no scrollea + fills con scroll interno / ❌ [qué] / — no aplica |
| Overflow / hover | ✅ / ❌ [qué] |
| Modo oscuro | ✅ / ❌ [qué] |
| Mobile 375px | ✅ / ❌ [qué] |

### Veredicto
✅ PASA — listo para el visto bueno del owner
⚠️ PASA CON RESERVAS — [qué mirar]
❌ NO PASA — [bloqueante]

### Issues
1. [descripción] — Severidad: High | Medium | Low
```

**El veredicto ✅ no cierra el track.** Los ACs de UI los cierra el **visto bueno visual del
owner** (spec 0030). Presentar las capturas y esperar.
