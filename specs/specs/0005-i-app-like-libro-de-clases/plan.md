# Plan 0005-i — App-like: `/admin/libro-de-clases` + `/secretaria/libro-de-clases`

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-08-26

---

## 1. Resumen ejecutivo

Convertir `LibroDeClasesComponent` (874 líneas, shared admin+secretaria) al patrón app-like
fill-screen: el documento deja de scrollear en desktop, y la sección activa (de las 7 que ya
tiene el componente vía `@if (activeSection() === 'x')`) pasa a ser una celda `.bento-fill` con
scroll interno propio. Además, "Control de Asistencia (Firma Diaria)" gana paginación por semana
(reemplaza el `@for` que apila todas las semanas) y "Calendario de Clases" —hoy la única sección
sin ningún `overflow` acotado— recibe el mismo tratamiento de scroll interno que el resto.
Orden: (1) resolver el modificador de grid correcto → (2) aplicar `.bento-fill` a las 7
secciones de forma uniforme → (3) paginación de Asistencia → (4) `/verify` exhaustivo (2 rutas ×
7 secciones × 3 viewports, heredado del checklist de la ASG).

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/features/libro-de-clases/libro-de-clases.component.spec.ts` | Test (Smart) | Cubre la lógica de paginación por semana (`computed()` de semana visible a partir del índice) — no existe hoy ningún `.spec.ts` para este componente. |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/features/libro-de-clases/libro-de-clases.component.ts` | Root a `bento-grid--fill-screen-4` (o el modificador que resulte del punto 1 de Riesgos); las 7 secciones activas envueltas en `.bento-fill flex flex-col` con su tabla en `flex-1 min-h-0 overflow-y-auto`; sección "asistencia" reemplaza el `@for` de semanas por paginación (signal `selectedWeekIndex` + stepper prev/next, patrón `mesAnterior`/`mesSiguiente` de `historial-cuadraturas-content`); sección "calendario" gana el `overflow-y-auto` acotado que hoy no tiene. | AC1-AC5 de la spec. |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|

---

## 3. Reutilización (Discovery)

> Salida del paso DESCUBRIR. Qué ya existe que vamos a aprovechar.
> Esto se cruza con `indices/*.md` del proyecto.

### Componentes existentes que reutilizamos
- `<app-libro-de-clases-subnav>` — navegación entre secciones, sin cambios (ya hace show/hide
  real, confirmado en spec.md).
- `<app-icon>` `chevron-left`/`chevron-right` — para el stepper de semana (mismo patrón visual
  que `mesAnterior`/`mesSiguiente` de `app-historial-cuadraturas-content` y
  `app-liquidaciones-content`, ambos documentados en `indices/COMPONENTS.md`).
- `BentoGridLayoutDirective` + modificadores `--fill-screen*` existentes
  (`src/styles/layout/_bento-grid.scss`) — ver Riesgo #1 sobre cuál calza mejor.
- `.micro-label` para el label "Semana X de Y" del stepper (vocabulario tipográfico del DS, no
  recomponer a mano).

### Facades/Services existentes que extendemos
- Ninguno — `LibroDeClasesFacade.asistenciaSemanal()`/`.calendario()` ya exponen los datos
  completos; la paginación es estado de UI puro en el Smart Component, no en el Facade (spec.md
  §5, confirmado: "no requiere tocar el Facade si el dato ya viene completo").

### Componentes/Facades que NO existen y debemos crear
- Ninguno — el stepper de semana se implementa inline en el template del Smart (mismo criterio
  que `historial-cuadraturas-content`, que tampoco extrajo un componente dedicado para su
  navegador de mes).

---

## 4. Modelo de datos

N/A — spec de layout puro, sin persistencia nueva (spec.md §6).

---

## 5. Arquitectura del feature

### Diagrama de flujo (verbal)

```
LibroDeClasesComponent (Smart, ya existe)
  ├─ inject(LibroDeClasesFacade)          [sin cambios]
  ├─ activeSection = signal<Section>       [sin cambios, ya existe]
  ├─ selectedWeekIndex = signal<number>(0) [NUEVO — estado UI puro]
  ├─ visibleWeek = computed(() =>
  │     facade.asistenciaSemanal()[selectedWeekIndex()])  [NUEVO — decisión con lógica, con test]
  ├─ totalWeeks = computed(() => facade.asistenciaSemanal().length)  [NUEVO]
  │
  ├─ <app-section-hero>                    [sin cambios]
  ├─ <div class="bento-banner card">Filtros</div>  [sin cambios, fila fija]
  ├─ <div class="bento-banner">Subnav</div>        [sin cambios, fila fija]
  └─ @if (activeSection() === 'x') {
       <section class="bento-fill flex flex-col min-h-0" appCardHover>
         [header sección — fijo, shrink-0]
         [tabla — flex-1 min-h-0 overflow-y-auto]
         [SOLO en 'asistencia': stepper prev/next semana — shrink-0, footer]
       </section>
     }
```

### Capas tocadas

- **Smart**: `features/libro-de-clases/libro-de-clases.component.ts` (único archivo de lógica —
  la spec confirma que no hace falta tocar Dumb ni Facade).
- **Dumb**: `app-libro-de-clases-subnav` — sin cambios.
- **Facade**: `LibroDeClasesFacade` — sin cambios.
- **Estilos**: `src/styles/layout/_bento-grid.scss` — **posible** ajuste si el Riesgo #1 exige un
  modificador nuevo (ver más abajo); de lo contrario, cero CSS nuevo.

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — Patrón Facade sin cambios (no se toca), OnPush ya presente, Signals
      nuevos solo de UI.
- [ ] `facades.md` — No aplica (sin cambios de Facade).
- [ ] `models.md` — No aplica (sin DTO/UI models nuevos).
- [x] `visual-system.md` — Patrón App-like (fill-screen), `.bento-fill`, vocabulario tipográfico
      (`.micro-label`), sin colores hardcodeados.
- [ ] `swr-pattern.md` — No aplica (sin fetch nuevo).
- [ ] `notifications.md` — No aplica.
- [x] `testing-tdd.md` — `computed()` de semana visible es una decisión (filtra/deriva), no un
      binding — test obligatorio.
- [ ] `ai-readability.md` — Revisar si el stepper de semana necesita `data-llm-action` (botones
      prev/next de semana cambian lo que se ve, no mutan negocio — evaluar en implementación si
      aplica igual que otros steppers del proyecto).

---

## 7. Plan de testing

- **Unitarios (nuevo `.spec.ts`)**:
  - `visibleWeek()` devuelve la semana correcta según `selectedWeekIndex()`.
  - `visibleWeek()` devuelve `undefined`/maneja con gracia cuando `asistenciaSemanal()` está
    vacío (0 semanas).
  - `selectedWeekIndex()` no se sale de rango (`0` a `totalWeeks()-1`) al navegar con
    prev/next en los bordes (primera/última semana).
  - `selectedWeekIndex()` se resetea a `0` si cambian los datos de asistencia (nueva
    promoción/curso seleccionado) — evita quedar apuntando a un índice inválido.
- **QA manual (`/verify`, checklist heredado de la ASG)**:
  - Ambas rutas (admin y secretaria).
  - 390×844, 1440×900, y 768 de alto.
  - Las 7 secciones, una por una.
  - `force-compact` con un drawer abierto encima.
  - Probe de contrato app-like (documento no scrollea en desktop, `.bento-fill` scrollea
    internamente) — ver `.claude/skills/verify/SKILL.md` probe 5.
  - Paginación de Asistencia con 0, 1, y 3+ semanas de datos.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| **#1 — Ningún modificador `--fill-screen*` existente calza exacto con la estructura real** (hero + filtros fijo + subnav fijo + sección protagonista = 4 filas, pero `--fill-screen-4` asume que la 3ª fila es "variable pero acotada" con piso 100px y `1fr`, no una fila fija corta como el subnav — riesgo de que el subnav se estire de más si sobra alto). | Media | Probar primero con `--fill-screen-4` tal cual (subnav en la fila 3). Si `/verify` muestra que el subnav se estira, cambiar esa fila a una altura fija real (`auto` sin `1fr`) — requiere tocar `_bento-grid.scss` con un comentario que documente por qué el patrón existente no alcanzaba (mismo criterio que dejó fill-screen-4 documentado tras el bug de spec 0003-i). |
| **#2 — Paginación de Asistencia pierde estado al cambiar de sección y volver** (si `selectedWeekIndex` no se resetea correctamente entre curso/promoción, puede mostrar una semana equivocada o un índice fuera de rango). | Media | Cubierto explícitamente en el plan de testing (reset a `0` al cambiar `asistenciaSemanal()`). |
| **#3 — Alguna de las 7 secciones "se ve bien a simple vista" pero el documento sigue scrolleando** (mismo tipo de bug real que encontró `0003-i`/`0004-i` en sesiones anteriores — el ojo no detecta 1-2px de overflow). | Media | Probe de contrato app-like con `getBoundingClientRect`/`scrollHeight` (no solo captura visual), igual que en las specs hermanas ya cerradas. |
| **#4 — Contenido corto deja `.bento-fill` con espacio muerto visible** (ej. "Profesores por Módulo" con solo 3-4 filas, dentro de una celda que mide "el resto del viewport"). | Baja-Media | AC-E3 ya lo cubre explícitamente; aplicar el mismo criterio de `visual-system.md` (centrar contenido corto/empty states en el alto disponible, no dejarlos pegados arriba). |

---

## 9. Orden de implementación

1. Root del componente: aplicar el modificador de grid elegido (`bento-grid--fill-screen-4` como
   primer intento) + `#bentoGrid` si falta.
2. Envolver la sección activa (las 7, una a la vez vía `@if`) en `.bento-fill flex flex-col
   min-h-0`, con su tabla en `flex-1 min-h-0 overflow-y-auto` — empezar por "calendario" (la más
   atrasada, sin ningún tope hoy) para validar el patrón antes de replicarlo a las otras 6.
3. Replicar el mismo wrapper a `cabecera`, `profesores`, `alumnos`, `evaluaciones`, `resumen`.
4. Implementar la paginación de "asistencia": `selectedWeekIndex`/`visibleWeek`/`totalWeeks` +
   stepper prev/next en el footer de la card (reemplaza el `@for` de semanas).
5. Escribir `libro-de-clases.component.spec.ts` con los casos del plan de testing (§7).
6. `npm run lint:arch` + `npm run test:ci`.
7. `/verify` completo (checklist §7, ambas rutas × 7 secciones × 3 viewports).
8. Actualizar `indices/COMPONENTS.md` (entrada de `app-libro-de-clases` — hoy no documentada
   explícitamente, verificar en implementación) y `indices/APP-LIKE-ROLLOUT.md` (marcar cerrado,
   paso 17/17 del rollout — el último).

---

## 10. Estimación

M (según talla confirmada por el owner) — 1-2 días. El grueso del esfuerzo es la replicación
cuidadosa del wrapper `.bento-fill` a 7 secciones sin romper ninguna, más el `/verify` exhaustivo
de 2 rutas × 7 secciones × 3 viewports heredado del checklist de la ASG.

---

## Changelog

- 2026-08-26 — plan inicial. Talla M confirmada por el owner (ningún modificador de grid calza
  exacto + paginación nueva con test obligatorio + QA pesado heredado de la ASG).
