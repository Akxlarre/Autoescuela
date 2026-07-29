# Plan 0031-b — Ciclos Teóricos fill-screen + fix shift de tabs

> **Spec:** [spec.md](./spec.md) · **Status:** approved · **Talla:** S

---

## 1. Resumen

Aplicar `--fill-screen-kpi` también al tab Ciclos (dejar el modificador siempre activo, no condicional por tab) y convertir `<app-ciclos-teoricos-content>` en una celda `.bento-fill` cuyo contenido interno (selector + 2 columnas) usa scroll interno por columna. Pasar `isDesktopLayout()` del parent al child para el switch col/row por-contenedor. Cero SCSS nuevo. Esto elimina el scroll de página en Ciclos → sin scrollbar que aparezca/desaparezca → sin shift de tabs (AC1).

---

## 2. Inventario de impacto

### MODIFICAR

| Path | Cambio |
|------|--------|
| `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts` | (1) modificador `--fill-screen-kpi` pasa de condicional (`activeTab()==='practicas'`) a SIEMPRE activo; (2) `<app-ciclos-teoricos-content>` recibe clases de celda fill (`bento-fill flex flex-col min-h-0 overflow-hidden`) + input `[isDesktop]="isDesktopLayout()"` |
| `src/app/shared/components/ciclos-teoricos-content/ciclos-teoricos-content.component.ts` | (1) input `isDesktop`; (2) host `display:flex` (o root fill); (3) root div → fill container (selector `shrink-0` + área de columnas `flex-1 min-h-0`); (4) columna "Clases" con wrapper de scroll interno; (5) grid-cols switch usa `isDesktop` en vez de `lg:grid-cols-3` |
| `src/app/shared/components/ciclos-teoricos-content/ciclos-teoricos-content.component.spec.ts` | Si existe: sin cambios de lógica; si el nuevo input rompe algún test, ajustar. (Layout puro, sin lógica nueva testeable — no hay `.spec.ts` de este Dumb hoy.) |

### Verificación negativa
- `_bento-grid.scss` sin cambios (AC5).

---

## 3. Reutilización

- `--fill-screen-kpi` + `.bento-fill` (specs 0029/0028) — sin tocar SCSS.
- Patrón de host-como-celda-fill: el mismo que usa el div de Prácticas (`bento-fill flex flex-col min-h-0 overflow-hidden`), aplicado al host del componente Angular vía `class=` (el host es un elemento; agregar `flex flex-col` lo hace `display:flex`).
- `isDesktopLayout()` del parent (0030) — se pasa como input, el child no inyecta LayoutService (Dumb estricto).

---

## 4. Arquitectura

```
asistencia-clase-b-content (parent Dumb)
  div.bento-grid.bento-grid--fill-screen-kpi   ← modificador SIEMPRE activo
    ├─ app-section-hero (fila 1)
    ├─ div tabs (fila 2)
    └─ (fila 3, según tab):
         · Prácticas: div.bento-fill (tabla + rail alertas)  [0030, sin cambios]
         · Ciclos:    app-ciclos-teoricos-content.bento-fill.flex.flex-col
                        [isDesktop]="isDesktopLayout()"
                        └─ :host display:flex → root div flex-1 min-h-0
                             ├─ selector de ciclo (shrink-0)
                             └─ área columnas (flex-1 min-h-0):
                                  desktop → 2 cols (Clases scroll interno | Roster scroll interno)
                                  móvil   → apila, scroll natural
```

### Detalle clave (host fill)
`.bento-fill` emite `contain:size; min-height:0` solo en `@container layoutmain ≥1024`. Para que aplique sobre el host de un componente Angular, el host debe tener `display:flex` (agregado vía las clases `flex flex-col` en el `class=` del parent) y tamaño determinado por la fila `minmax(0,1fr)` del grid. El root div interno usa `flex-1 min-h-0` para llenar el host.

---

## 5. Restricciones aplicables

`architecture.md` (Dumb estricto — el child NO inyecta LayoutService, recibe `isDesktop` por input), `visual-system.md` (canon bento fill, tokens), `ai-readability.md` (data-llm-* ya presentes, sin cambios).

---

## 6. Testing

- **Unit:** no hay lógica nueva testeable (layout puro). El componente `ciclos-teoricos-content` no tiene `.spec.ts` y no se agrega (sin `computed`/decisión nueva — solo un input booleano de presentación).
- **Build:** `ng build` limpio (cambios de template en 2 componentes).
- **QA `/verify` (Claude in Chrome, ambas rutas):**
  - AC1: alternar Prácticas↔Ciclos, medir `left/right` de la fila de tabs — sin cambio. Confirmar `.shell-content` no scrollea en NINGÚN tab (desktop).
  - AC2/AC3: desktop, ciclo con 6 clases — selector fijo, columnas con scroll interno independiente.
  - AC4: `<main>` angostado → apila 1 columna, scroll natural.
  - AC-E1/E2/E3: sin ciclo, loading, panel destinatarios abierto.
  - Claro/oscuro, 0 errores de consola nuevos.
- **Estático:** `git diff --stat` sin `_bento-grid.scss`; `npm run test:ci` + `lint:arch` verdes.

---

## 7. Riesgos

| Riesgo | Prob | Mitigación |
|--------|------|-----------|
| `contain:size` sobre el host de un componente Angular no fija altura (host no es `display:flex`) | Media | Agregar `flex flex-col` al `class=` del host; verificar en vivo que el host toma la altura de la fila. Fallback: `:host{display:flex;flex-direction:column;min-height:0}` en el styles del componente. |
| La columna "Clases" con panel de destinatarios expandido + scroll interno anida scroll (panel tiene `max-h-48 overflow-y-auto`) | Baja | El panel interno ya scrollea solo; la columna scrollea el resto. Verificar en QA (AC-E3). |
| Grid siempre `--fill-screen-kpi`: en el tab Prácticas hoy es condicional; volverlo incondicional no debe alterar Prácticas (misma estructura de 3 filas) | Baja | Prácticas ya usa exactamente ese modificador; volverlo incondicional no cambia su render. Confirmar en QA. |
| Modificador incondicional afecta el conteo de hijos del grid (siempre 3) | Baja | Hero + tabs + 1 contenido (el `@if` del tab) = 3 hijos siempre. OK. |

---

## 8. Orden de implementación

1. Child (`ciclos-teoricos-content`): input `isDesktop`, host flex, root fill, columna Clases con scroll interno, grid-cols por `isDesktop`.
2. Parent (`asistencia-clase-b-content`): modificador siempre activo + clases fill + `[isDesktop]` en el child.
3. `ng build` → QA `/verify` (AC1 el más importante: sin shift) → `test:ci` + `lint:arch` → `/spec-verify`.

---

## 9. Estimación

S — media sesión.

---

## Changelog
- 2026-07-13 — plan inicial (talla S).
