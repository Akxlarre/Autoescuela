# Fix: accesibilidad — nombre accesible en botones icon-only, foco en menús, primer guardrail a11y
> id: fix-079-b-accesibilidad-nombres-y-foco
> refs: ASG-b-054
> status: done
> closed: 2026-07-31
> created: 2026-07-31

## Root Cause

**[Heredado de ASG-b-054, a confirmar]:** las prioridades de enforcement del DS están
invertidas. Hay **8 reglas ARCH** automatizadas vigilando higiene de color y clases muertas, y
**cero** vigilando accesibilidad. Consecuencia directa: la deuda de color está medida al dígito,
la de a11y estaba estimada en "2 archivos conocidos, puede haber más".

Auditado el 2026-07-31: **94 botones icon-only sin `aria-label`, en 41 archivos**. Heurístico
conservador — `<button>` que contiene `<app-icon>`, ningún texto visible ni interpolación, y
ningún `aria-label`. Para un lector de pantalla los 94 se anuncian solo como "botón".

Además, `section-hero.component.ts` (el menú de acciones de ~50 páginas) no maneja foco: solo
cierra por click-outside. Sin `Escape`, sin foco al primer ítem al abrir, sin devolver el foco
al trigger al cerrar.

## ACs Afectados

Ninguno — fix autónomo, sin AC de spec previa.
Referencia: `specs/assignments/ASG-b-054-accesibilidad-primer-guardrail.md`.

## Archivos involucrados

- 41 archivos con botones icon-only (lista completa generada por el script de auditoría)
- `src/app/shared/components/section-hero/section-hero.component.ts` — manejo de foco
- `scripts/lib/` — detector del guardrail a11y

## Inventario (descubrimiento — hecho)

Auditoría con contexto: para cada botón se extrajo el ícono, el `pTooltip`/`title`, el handler
`(click)` y el `data-llm-action`. Resultado:

- **73 de 94 tienen señal fuerte** (`pTooltip`, `title` o `data-llm-action`) → el `aria-label`
  correcto es derivable casi mecánicamente del texto que ya existe.
- **21 sin señal** → requieren leer el contexto del template.

> ⚠️ Que 73 tengan `pTooltip` **no significa que estén medio resueltos**. Un tooltip de PrimeNG
> resuelve el descubrimiento visual con mouse; no aporta nombre accesible ni sirve por teclado.
> Lo que significa es que la *intención* ya está escrita en el archivo — hay que promoverla a
> `aria-label`, no inventarla.

Distribución por ícono (predice el verbo del label):

| Usos | Ícono | Label esperado |
|---|---|---|
| 21 | `eye` | "Ver …" |
| 13 | `x` | "Cerrar …" |
| 13 | `chevron-left` / `chevron-right` | navegación (mes/página anterior/siguiente) |
| 13 | `edit` / `pencil` | "Editar …" |
| 9 | `trash-2` | "Eliminar …" |
| 6 | `user-plus` | "Asignar/Agregar …" |
| 4 | `rotate-ccw` | "Reintentar/Revertir …" |
| 3 | `file-text` | "Ver documento …" |
| resto | `check`, `calendar`, `dollar-sign`, `external-link`, `plus`, `message-circle`, `x-circle`, `refresh-cw` | 1-2 c/u |

**2 casos especiales** que necesitan `[attr.aria-label]` dinámico, no estático:
- ícono `iconName` (variable) — el label depende del estado
- ícono `theme.darkMode() ? 'sun' : 'moon'` — el toggle de tema: el label debe decir la **acción**
  ("Activar modo claro"), no el estado actual

## Corrección al inventario — 2 falsos positivos

Antes de aplicar los labels, se cruzó cada uno de los 94 contra `pButton label="..."`
(PrimeNG renderiza ese atributo como texto visible hijo del botón — no aparece entre los tags
del template estático, así que el heurístico inicial no lo veía):

- `vehicle-maintenances.component.ts:99` (`label="Registrar Servicio"`)
- `flota-list-content.component.ts:140` (`label="Actualizar"`)

Ambos **ya tenían** nombre accesible. Se excluyeron de la migración (tocarlos habría sido
`aria-label` redundante) y del guardrail. **Conteo real: 92 botones icon-only, no 94.**
Verificado además que ningún botón migrado tiene `aria-label` ≠ `label` de pButton (0
violaciones de WCAG 2.5.3 Label-in-Name introducidas).

## Cambio

### 1. Labels — primera pasada: 92 botones resueltos, cero texto inventado

> ⚠️ Esta cifra de 92 fue la que dejó el inventario inicial. La sección **2.5** más abajo
> documenta cómo se encontraron 2 instancias más que ningún barrido estático había visto —
> el total real terminó siendo 94/94. Se deja esta sección tal como se escribió en el
> momento porque documenta fielmente el proceso, y la 2.5 dice explícitamente qué cambió.

Todo `aria-label` sale de texto que **ya existía** en el propio archivo — nunca se redactó
desde cero, para no arriesgar una descripción que no coincida con la acción real:

- **71 automáticos** vía `scripts/migrate-a11y-button-labels.mjs` (nuevo, idempotente —
  verificado: 2ª corrida = 0 cambios):
  - **64 por reuso directo de `pTooltip`/`title`** — el texto ya estaba escrito para el
    hover, se promovió tal cual a `aria-label`.
  - **7 por "sibling"**: cuando un botón sin tooltip tiene el mismo ícono + mismo handler
    `(click)` que otro botón del mismo archivo que sí tiene tooltip (patrón vista
    tabla/card duplicada), reusa esa etiqueta.
- **21 manuales**, leyendo el `(click)` handler y el contexto circundante de cada uno
  (navegación de semana/página, quitar archivo/descuento, eliminar turno/ingreso/egreso,
  limpiar búsqueda, etc.) — full detalle en el diff de cada archivo.
- **2 casos con `[attr.aria-label]` dinámico** (no estático), porque el label depende del
  estado:
  - `hero-tab.component.ts:731` (picker de íconos) — ya tenía `[title]="iconName"`
    (técnicamente ya daba nombre accesible vía el algoritmo de accname del navegador), se
    sumó `[attr.aria-label]="iconName"` como refuerzo explícito, más confiable entre
    lectores de pantalla que depender solo de `title`.
  - `ajustes-drawer.component.ts:203` (toggle de tema) — el ícono muestra el *destino*
    (sol cuando está oscuro, luna cuando está claro), así que el label describe la
    **acción**, no el ícono: `theme.darkMode() ? 'Activar modo claro' : 'Activar modo oscuro'`.
    Un label que describiera el ícono literal ("sol"/"luna") sería ambiguo para quien no ve
    la metáfora visual.

Verificación final (barrido independiente, no solo confiar en el codemod): **0 botones
icon-only sin nombre accesible** en todo `src/app`.

### 2. Foco en el menú de `section-hero.component.ts` (WAI-ARIA menu button pattern)

Afecta a los **2 paneles de menú** del componente (modo full y modo slim, mismo
`openMenuId()`/`toggleMenu()`/`closeMenu()` compartido):

- **Foco al primer ítem al abrir**: `effect()` en el constructor que observa `openMenuId()`
  y, vía `requestAnimationFrame` (el panel recién se monta ese mismo ciclo por el `@if`, hay
  que esperar al DOM), enfoca `.hero-menu-panel__item:not(:disabled)` dentro del panel
  (`viewChild('menuPanelRef')`, compartido por ambos `@if/@else` mutuamente exclusivos).
- **`Escape` cierra**: `(keydown.escape)` en el contenedor del panel (`role="menu"`) —
  burbujea desde el ítem enfocado, no hace falta un listener global de teclado nuevo.
- **Devuelve el foco al trigger al cerrar** — con una decisión de diseño no pedida
  explícitamente por la Asignación: `closeMenu(restoreFocus = false)` **solo** restaura el
  foco cuando el cierre lo inició el teclado (`Escape`) o la selección de un ítem
  (`onMenuItemClick`). El cierre por **click fuera** (mouse) sigue **sin** robar el foco —
  forzarlo de vuelta al trigger ahí sería secuestrar el foco de lo que el usuario acaba de
  tocar con el mouse, el propio anti-patrón que el WAI-ARIA Authoring Practices Guide
  advierte evitar. Documentado en el propio código (comentario en `outsideListener` y
  JSDoc de `closeMenu`).

### 2.5. El "0 restantes" era falso — 2 botones más, encontrados por verificación real en el navegador

La primera pasada de esta sección decía "0 botones icon-only sin nombre accesible", y era
**incorrecta** — el barrido que lo confirmaba usaba el mismo regex del audit original, que
tiene un punto ciego real con el control de flujo de Angular. Cronología de cómo se encontró:

1. Verificando el fix en el navegador real (`/app/admin/alumnos`), un botón con ícono
   `download` y tooltip "Exportar Ficha PDF" apareció **sin `aria-label`** en el DOM
   inspeccionado con `getAttribute` — algo que el barrido estático había dado por resuelto.
2. La causa: el botón alterna entre `<app-icon name="loader-circle">` (cargando) y
   `<app-icon name="download">` (normal) usando `@if (isGeneratingFicha() === alumno.id) {
   } @else { }`. Todo regex que trata "texto tras quitar tags HTML" como señal de "tiene
   contenido visible" **confunde la sintaxis `@if (...) {` con texto real** — el
   `@if(...)` queda como caracteres sueltos que no están dentro de un tag `<...>`, así que
   sobrevive al `.replace(/<[^>]*>/g, ' ')` y hace pasar al botón como "no icon-only" aunque
   en runtime SÍ lo sea (Angular compila el `@if/@else` fuera, nunca se renderiza como texto).
3. Ese mismo punto ciego estaba en el **script de auditoría original** (el que produjo "94
   botones") — así que estos 2 casos **nunca estuvieron en la lista de 94** en absoluto, ni
   siquiera como "sin señal". Un barrido dirigido con `@if|@else` como filtro encontró 91
   candidatos — pero la mayoría son ruido (tienen texto real como "Guardando..." dentro del
   `@else`, legítimamente no son icon-only). El filtro correcto requiere **quitar la sintaxis
   de control de flujo preservando su contenido** antes de decidir si hay texto visible.
4. Primer intento de ese filtro (regex `[^)]*` para la condición del `@if`) **también falló**
   — condiciones con sus propios paréntesis anidados como
   `isGeneratingFicha() === alumno.enrollmentId` rompen `[^)]*` (para en el primer `)`, el de
   `isGeneratingFicha()`, nunca llega al que cierra la condición completa). Corregido con
   `.*` greedy (sin excluir `)`), que retrocede hasta encontrar el último `)` seguido de `{`
   en la misma línea — maneja paréntesis anidados sin ambigüedad porque Prettier garantiza
   condición+llave en una sola línea en este codebase.
5. Con el filtro corregido: **exactamente 2 instancias reales**, ambas en
   `alumnos-list-content.component.ts` (líneas 480 y 630 — vista tabla y vista card del
   mismo botón "Exportar Ficha PDF", el patrón de duplicación que se repite en todo el
   archivo). Arregladas reusando el texto de su propio `pTooltip` (mismo criterio que el
   resto del track: cero texto inventado).
6. **Un tropiezo extra al aplicarlas**: la primera `Edit` con `replace_all: true` incluyó la
   clase CSS completa del botón en el `old_string` — la vista tabla y la vista card tienen
   `class=""` **distintas** (hover states diferentes), así que el replace_all solo encontró
   **1 de las 2** ocurrencias, aunque el mensaje de la herramienta decía "reemplazado con
   éxito" (verdad parcial: reemplazó todo lo que coincidía, que era 1 sola instancia). Se
   detectó porque el barrido de verificación post-fix, corriendo el detector YA corregido,
   seguía reportando 1 — no por relectura manual del diff.
7. `scripts/lib/a11y-guardrails.js` (el guardrail ARCH-20 nuevo, ver más abajo) se actualizó
   con el mismo fix de `stripControlFlowSyntax`, y se agregaron 2 casos de regresión a su
   micro-suite reproduciendo exactamente este bug — para que ARCH-20, una vez cableado,
   nunca tenga este punto ciego.

**Total real: 94 botones** (no 92) — 92 del inventario original + 2 encontrados por este
punto ciego. Verificación final, con el detector corregido, corrida contra `src/app`
completo (no una muestra): **0 restantes.**

### 3. Guardrails nuevos — escritos y testeados, **NO cableados** (bloqueado por File Protector)

Dos detectores nuevos, ambos con micro-suite propia y verdes:

- **ARCH-19** (`findAdhocTypography` en `scripts/lib/class-discipline.js`) — heredado de
  fix-078-b, seguía sin cablear por el mismo motivo.
- **ARCH-20** (`findIconOnlyButtonsWithoutLabel`, nuevo archivo
  `scripts/lib/a11y-guardrails.js` + `a11y-guardrails.test.mjs`, 11/11 casos verdes) — a
  diferencia de ARCH-15/16/17/19 (ratchets con backlog pre-existente), **arranca en CERO y
  es error duro desde el día uno**: no hay backlog legítimo que tolerar en accesibilidad.

**Por qué no están cableados:** requiere editar `scripts/architect.js`, protegido por el
File Protector (`.claude/hooks/pre-write-guard.js`) — bloquea Edit/Write del agente sobre
ese archivo específico, **incluso con autorización explícita del usuario en el chat**. El
propio mensaje del hook es la instrucción de diseño: *"pide al humano que lo haga
manualmente"*. Se evaluó y descartó deliberadamente escribir el archivo vía Bash — habría
sido sortear por otra vía la misma protección que el hook bloquea, contra el propósito
explícito del guardrail (evitar que un agente modifique el archivo que define TODOS los
demás guardrails del repo compartido por 3 personas).

**Patch completo, listo para pegar, en**
`specs/fixes/fix-079-b-accesibilidad-nombres-y-foco/architect-js-patch.md`
(copiado también del scratchpad de la sesión). 6 puntos de inserción exactos + comandos de
verificación (`--update-ds-baseline`, re-correr `lint:arch`). Aplicar y luego avisar para
que yo actualice `DS_RULES` en `class-discipline.js` (ese sí lo puedo editar) sumando
`'ARCH-19'`.

### 4. Hallazgo fuera de alcance — el menú de `section-hero` no tiene ningún caller vivo

Al intentar verificar el foco en el navegador real, no se encontró **ninguna página** que
dispare el dropdown propio de `section-hero` (`SectionHeroAction.menu`, requiere
`density="full"`). Búsqueda exhaustiva: 43 archivos importan `SectionHeroAction`, pero
`grep -rn "^\s*menu:\s*\["` sobre todo `src/app` da **1 solo resultado**:
`admin-alumno-detalle.component.ts` — y ahí `menu:` alimenta un widget **completamente
distinto y local** (`.card-action-menu`, líneas 378-403 y 964-1040 del mismo archivo), no
el `hero-menu-panel` de `section-hero`. Su propio `<app-section-hero>` usa
`density="slim"` con `headerActions()` (sin `menu`), confirmando que no pasa por el código
que se tocó en el punto 2.

**Consecuencia para la verificación:** el fix de foco (punto 2) se validó con
`npx tsc --noEmit` (sin errores) y trazado manual cuidadoso del diff completo — no con
interacción real de teclado en el navegador, porque no hay ningún dato sembrado que abra
ese menú hoy. Los tests de componente Angular (`TestBed`) están `describe.skip()`
proyecto-ancho (`vitest.config.ts` no soporta compilación de templates junto con
facades/services — ver `alert-card.component.spec.ts:13-16`), así que tampoco había esa
vía disponible. El fix es correcto por lectura de código y compila limpio, pero **no fue
ejercitado en runtime** — dejar constancia explícita en vez de reportar un "verificado"
que no fue tan riguroso como el resto del track.

**Hallazgo adicional, fuera de alcance de este fix:** `.card-action-menu` en
`admin-alumno-detalle.component.ts` (el widget que SÍ está vivo) tiene el **mismo hueco de
a11y** que este fix resolvió en `section-hero` — sin `Escape`, sin manejo de foco al
abrir/cerrar (`grep` sobre el archivo: cero ocurrencias de `keydown`). Es una duplicación
completa de funcionalidad con su propia implementación, no una variante de
`section-hero.component.ts`. Tocarlo acá habría sido un segundo archivo con causa raíz
propia — fuera del contrato declarado en este fix (`Un fix = una causa raíz = un archivo
tocado`). Se deja como sugerencia de tarea aparte.

## Test de Regresión

- `npx tsc --noEmit` → sin errores en `section-hero.component.ts` (viewChild, effect,
  requestAnimationFrame, [attr.aria-label] dinámico) ni en `alumnos-list-content.component.ts`.
- `node scripts/lib/a11y-guardrails.test.mjs` → **13/13 casos verdes** (11 originales +
  2 de regresión agregados tras el hallazgo de §2.5: `@if/@else` con función en la condición
  del lado marcado, y `@if/@else` con texto real del lado NO marcado).
- Barrido final con el detector **ya corregido** (post §2.5), corrido contra `src/app`
  completo, no una muestra → **0 botones icon-only sin nombre accesible.** Este es el número
  que realmente vale — los "0" reportados antes de corregir el bug de `@if/@else` (tanto en
  el mid-track como en la primera versión de este mismo detector) eran falsos negativos.
- **Verificación en navegador real** (`ng serve` vivo, Browser MCP) — no solo estático:
  - `/app/admin/alumnos`: **16 de 16** botones "Exportar Ficha PDF" (el caso que reveló el
    bug de §2.5) con `getAttribute('aria-label') === 'Exportar Ficha PDF'` en el DOM real,
    tabla y card. El único `aria-label: null` encontrado en el mismo barrido es el botón
    "Exportar" del toolbar — tiene texto visible propio, nunca estuvo en alcance.
  - `/app/admin/instructores`, `/app/admin/alumnos`: `read_page` (árbol de accesibilidad)
    confirma "Ver detalle"/"Editar instructor"/"Ver ficha"/"Archivar alumno" anunciándose
    con su nombre real, no como "botón" genérico.
  - El foco del menú de `section-hero` **no se pudo verificar en vivo** — ver §4, ningún
    dato sembrado ejercita ese código hoy. Verificado por lectura de código + compile.
- `npm run lint:arch` → **exit 0**, 0 errores. Mismos warnings pre-existentes de siempre
  (ARCH-10 complejidad, ARCH-14 íconos sin uso, ARCH-11 backlog fix-030) — ninguno nuevo.
- `npm run test:ci` → **1651 passed, 3 skipped (pre-existentes), 0 failed, exit 0**
  (136/137 archivos, 195s). Idéntico al baseline de fix-078-b — sin regresiones.
- **Pendiente de quien aplique el patch de `architect.js`**: correr
  `npm run lint:arch -- --update-ds-baseline` y confirmar que ARCH-20 reporta 0 errores.
