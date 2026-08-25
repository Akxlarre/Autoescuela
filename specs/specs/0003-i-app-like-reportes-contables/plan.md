# Plan 0003-i — App-like: reportes contables (`admin` + `secretaria`)

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-08-24

---

## 1. Resumen ejecutivo

Reestructurar `reportes-contables-content.component.ts` (784 líneas, Dumb compartido entre
`admin` y `secretaria`) de 7 `.bento-banner` secuenciales a un shell app-like parcial: **Hero +
Filtros + Categorías (Ingresos/Gastos) + Gastos Fijos del Período quedan fijos, siempre
visibles, exactamente como se ven hoy** (decisión explícita del usuario, 2026-08-24, sobre
mockup real). Solo las 3 secciones restantes (Evolución Mensual, Detalle Diario, Rentabilidad)
se convierten en tabs — botones ubicados en la misma fila del selector de mes/"Aplicar", con
**un único panel fijo debajo** (`.bento-fill`, mismo lugar y tamaño siempre, solo cambia el
contenido interno según la tab activa) usando `<app-tabs variant="segmented">` + `@switch`,
mismo patrón que el piloto `fix-027-i`. Orden: (1) reestructurar template separando bloque fijo
vs. bloque de tabs, (2) verificar GSAP y `force-compact`, (3) `/verify` en las 4 rutas.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| Ninguno | — | Se reutiliza `<app-tabs>` ya existente (`shared/components/tabs/`) — mismo patrón que el piloto `fix-027-i`, no requiere componente de tabs nuevo |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/shared/components/reportes-contables-content/reportes-contables-content.component.ts` | Reestructurar template: Hero + Filtros fuera de tabs, 5 secciones agrupadas en 4 tabs vía `<app-tabs>` + `@switch`, root `.bento-grid--fill-screen-kpi` | Núcleo del cambio — único archivo con el contenido real (los wrappers de `admin`/`secretaria` son delgados, ~50 líneas, solo pasan inputs) |
| `src/app/features/admin/contabilidad-reportes/admin-contabilidad-reportes.component.ts` | Ninguno esperado (solo pasa inputs al Dumb) | Verificar igual que no rompa nada al cambiar el root del Dumb |
| `src/app/features/secretaria/contabilidad-reportes/secretaria-contabilidad-reportes.component.ts` | Ninguno esperado | Idem |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|
| Ninguno | — |

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `<app-tabs variant="segmented">` (`shared/components/tabs/tabs.component.ts`) — mismo
  componente y variante que usó el piloto `fix-027-i-app-like-instructor-ficha-tabs`. Ya soporta
  `TabOption[]` con `disabled`/`count`/`icon`, compresión adaptativa por tiers.
- `<app-section-hero>` — ya en uso para el Hero, no cambia.
- `<app-rentabilidad-cursos>` — ya en uso dentro del `.bento-banner` #7, pasa a vivir dentro de
  una tab sin cambios internos (es Dumb puro, sin Facade).
- `.bento-grid--fill-screen-kpi`, `.bento-fill` (`.claude/rules/visual-system.md`) — mismo
  modificador que usó el piloto (hero + fila de KPIs + contenido).

### Facades/Services existentes que extendemos
- Ninguno — el componente es Dumb (solo `input()`/`output()` + `GsapAnimationsService`, que es
  un service transversal sin estado de dominio, no un Facade). No se toca ningún Facade.

### Componentes/Facades que NO existen y debemos crear
- Ninguno.

---

## 4. Modelo de datos

N/A — solo reestructuración de UI existente. No hay tablas, RLS ni migraciones nuevas. Los datos
ya llegan vía `input()` (`kpis`, `ingresosCategoria`, `gastosCategoria`, `evolucionMensual`,
`detalleDiario`, `gastosFijos`, `isAdmin`, `filtros`) desde los Facades de los wrappers `admin`/
`secretaria` (fuera del alcance de este plan — no se tocan).

---

## 5. Arquitectura del feature

### Agrupación FINAL (revisión 2, 2026-08-25 — corrige la revisión 1 tras `/verify` real)

La revisión 1 (Hero+Filtros+Categorías+Gastos Fijos todos fijos) midió **954px reales**,
más que el viewport disponible (680-780px según breakpoint) — el panel de tabs colapsaba a
0px, un bug real encontrado en `/verify`, no cosmético. Estructura corregida:

**Filas fijas, cada una su propia fila del grid** (no entran en el sistema de tabs):
- Hero (KPIs + exportar)
- Barra de filtros (rango de fechas + Aplicar) — **las tabs viven en esta misma fila**, compactas
  (`style="width:auto"` sobre `<app-tabs>`, que por defecto es `width:100%` vía su propio `:host`)
- Categorías (Ingresos por Categoría + Gastos por Categoría) — fila propia, con **scroll interno
  propio** (`.reportes-categorias-scroll`) si su contenido no entra en el espacio disponible

**Bloque de tabs** — botones compactos en la fila de Filtros, **un único panel debajo con alto
mínimo garantizado** (280px, nunca colapsa):

| Tab | Sección que muestra | Visible para |
|---|---|---|
| **"Evolución Mensual"** | Tabla de evolución mensual | admin + secretaria |
| **"Detalle Diario"** | Tabla de detalle diario | admin + secretaria |
| **"Rentabilidad"** | `<app-rentabilidad-cursos>` | admin + secretaria |
| **"Gastos Fijos"** | Tabla/empty-state de gastos fijos + botón "Registrar Gasto Fijo" | **solo admin** — filtrado en `tabOptions()` (ahora `computed()`, no array constante); RLS `fixed_expenses` (fix-010-i, H-014) |

Gastos Fijos **pasó de sección fija a 4º tab** (decisión del usuario, 2026-08-25, sobre el
render real) — a diferencia de la revisión 1, donde era `@if (isAdmin())` fijo.

### Diagrama de flujo (verbal)

```
AdminContabilidadReportesComponent / SecretariaContabilidadReportesComponent (Smart, delgados)
  └─ inject(Facade correspondiente) — SIN CAMBIOS, fuera de alcance
  └─ <app-reportes-contables-content [inputs...]>  (Dumb, ESTE es el que se reestructura)
        ├─ .bento-hero → <app-section-hero>                              (fila 1, fija)
        ├─ .bento-banner → barra de filtros + <app-tabs> compacto inline (fila 2, fija — tabs viven acá)
        ├─ .bento-banner.reportes-categorias-scroll → Categorías          (fila 3, scroll interno si no entra)
        └─ .bento-fill @switch (activeTab())                              (fila 4, alto mínimo 280px garantizado)
              @case ('evolucion')     → Evolución Mensual
              @case ('detalle')       → Detalle Diario
              @case ('rentabilidad')  → <app-rentabilidad-cursos>
              @case ('gastos-fijos')  → @if (isAdmin()) { Gastos Fijos del Período }
```

### Capas tocadas

- **Smart**: `features/admin/contabilidad-reportes/`, `features/secretaria/contabilidad-reportes/`
  (sin cambios de lógica, solo verificar que sigan funcionando)
- **Dumb**: `shared/components/reportes-contables-content/reportes-contables-content.component.ts`
  (todo el cambio real)
- **Facade**: Ninguno tocado
- **Service**: `GsapAnimationsService` — revisar si `animateBentoGrid()` debe re-invocarse al
  cambiar de tab (ver riesgos)
- **Migration**: N/A

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — Dumb component, mantiene solo `input()`/`output()`, `OnPush` ya
  presente, no se agrega ningún Facade
- [ ] `facades.md` — N/A, no aplica (no es Facade ni Organismo)
- [ ] `models.md` — N/A, no se tocan modelos DTO/UI existentes
- [x] `visual-system.md` — Bento Grid (`--fill-screen-kpi`, `.bento-fill`), tabs (`app-tabs`),
  sin colores hardcodeados, patrón app-like completo (shell + densidad si aplica)
- [ ] `swr-pattern.md` — N/A, el Dumb no cachea nada (los Facades de los wrappers están fuera de
  alcance)
- [ ] `notifications.md` — N/A, no dispara notificaciones
- [x] `testing-tdd.md` — Si se agrega lógica nueva (ej. signal `activeTab()` o el `@switch`
  extraído a un método), requiere `.spec.ts` — ya no hay filtrado de tabs por `isAdmin()` (las 3
  tabs son iguales para ambos roles; Gastos Fijos sigue su `@if` de siempre, no es tab)
- [x] `ai-readability.md` — Ya tiene `data-llm-action`/`data-llm-description` en varios puntos
  (exportar, aplicar filtros, ver detalle) — mantenerlos, agregar si el cambio de tabs introduce
  nuevos controles interactivos

---

## 7. Plan de testing

- Tests unitarios: `.spec.ts` para el signal/computed `activeTab()` y el `@switch` de contenido
  si se extrae a un método — caso base: las 3 tabs (Evolución, Detalle, Rentabilidad) están
  siempre presentes sin importar `isAdmin()`.
- Tests de integración: N/A (Dumb sin Facade, no hay integración con BD que testear en este
  track).
- QA manual (golden path + edge cases):
  - `/verify` en las 4 rutas (`admin`/`secretaria` × desktop/mobile), 390×844, 1440×900 y 768 de
    alto (checklist obligatorio del rollout app-like).
  - Confirmar que Hero, Filtros, Categorías y Gastos Fijos se ven exactamente igual que hoy (sin
    regresión visual) — solo cambia lo que había debajo de "Evolución Mensual" en adelante.
  - Confirmar que secretaría sigue sin ver "Gastos Fijos del Período" en ningún breakpoint
    (`@if (isAdmin())` existente, no se toca esa condición).
  - Confirmar que las 3 tabs nuevas se ven igual para admin y secretaria.
  - Confirmar que cambiar de tab no rompe el menú de exportar (vive en el Hero, fijo).
  - Confirmar que `force-compact` (drawer abierto) sigue funcionando si aplica a esta ruta.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Perder alguna de las 7 secciones originales al reagrupar | Media | Catálogo ya hecho en este plan (§5) — cada sección original mapeada 1:1 (4 fijas + 3 en tabs); QA visual compara contra el estado actual antes de cerrar |
| `GsapAnimationsService.animateBentoGrid()` hoy anima el grid completo en `ngAfterViewInit` — al cambiar de tab con `@switch`, el contenido nuevo no se anima (`ngAfterViewInit` no se re-dispara) | Media | Decidir en implementación: o se acepta que el stagger solo corre en la carga inicial (igual que el piloto `fix-027-i`, que no re-anima al cambiar de tab), o se agrega un `effect()` que re-invoque la animación al cambiar `activeTab()` — documentar la decisión tomada |
| Los wrappers `admin`/`secretaria` podrían depender implícitamente del layout actual del Dumb (ej. altura fija) | Baja | Son ~50-58 líneas, solo pasan inputs — revisado en `/verify`, sin problemas detectados |
| **[MATERIALIZADO en /verify, revisión 1]** El bloque fijo (Hero+Filtros+Categorías+Gastos Fijos, 954px) excedía el viewport disponible (680-780px) — el panel de tabs colapsaba a 0px, invisible sin scroll posible (bug real, no cosmético) | — | **RESUELTO (revisión 2):** Filtros separado de Categorías en filas propias; Gastos Fijos pasó a ser tab (ya no fijo); Categorías con scroll interno propio (`.reportes-categorias-scroll`); panel de tabs con alto mínimo garantizado 280px vía `.bento-grid--fill-screen-4` (`grid-template-rows: auto auto minmax(100px,1fr) minmax(280px,1fr)` — Categorías también con piso propio tras encontrar que colapsaba a 0px a 768px de alto, ver fila de abajo —, `grid-row:-2` en `.bento-fill`). Confirmado visualmente en `/verify` (desktop 1280×800/1440×768/1680×900, mobile 390×844, admin y secretaria). Un intento posterior de darle más peso al panel (`2fr`) fue revertido por feedback directo del usuario: apretaba Categorías |
| `<app-tabs>` tiene `:host { width:100%, display:block }` — al insertarlo en una fila flex compacta (junto a "Mes actual"/"Aplicar"), forzaba su propia línea nueva (feedback visual del usuario) | — | **RESUELTO:** `style="width:auto; flex:0 0 auto"` inline sobre `<app-tabs>` — el inline style tiene mayor especificidad que el `:host` del componente hijo, sin tocar el componente `app-tabs` compartido |

---

## 9. Orden de implementación

1. Reestructurar el template: dejar Hero + Filtros + Categorías + Gastos Fijos tal cual están
   hoy (mismos `.bento-banner`), agregar `<app-tabs variant="segmented">` en la fila de filtros
   y un `.bento-fill @switch (activeTab())` nuevo debajo, con las 3 secciones movidas adentro.
2. Agregar el signal `activeTab()` al componente (sin filtrado por rol — las 3 tabs son iguales
   para admin y secretaria).
3. Resolver el riesgo de qué modificador `--fill-screen*` aplica con 4 filas fijas (ver §8) —
   probar en navegador, documentar la decisión tomada.
4. Resolver el riesgo de GSAP (re-animar o no al cambiar de tab) — documentar la decisión.
5. `.spec.ts` para `activeTab()` / el `@switch` si se extrae a método.
6. `/verify` en las 4 rutas × 3 breakpoints (checklist app-like completo) — comparar
   explícitamente contra capturas del estado actual para las 4 secciones fijas.
7. Actualizar `indices/APP-LIKE-ROLLOUT.md` marcando esta fila como cerrada.

---

## 10. Estimación

M — 1-3 días (reestructuración de un componente grande con decisión de diseño, sin backend).

---

## Changelog

- 2026-08-24 — plan generado con `/spec-plan`, talla M confirmada por el usuario
- 2026-08-25 — revisión 2 de la arquitectura tras `/verify` real: el bloque fijo de la revisión
  1 no entraba en el viewport (bug real, panel de tabs colapsaba a 0px). Filtros y Categorías
  separados en filas propias, Gastos Fijos pasó de sección fija a 4º tab, tabs compactas
  inline, panel de tabs con alto mínimo garantizado. Confirmado visualmente admin+secretaria,
  desktop+mobile
