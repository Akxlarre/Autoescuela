# Spec 0031-b — Ciclos Teóricos: fill-screen app-like + fix del shift de tabs por scrollbar

> **Status:** done
> **Created:** 2026-07-13
> **Owner:** Akxlarre
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Continuación directa de la spec 0030. Al cerrar 0030 se dejó explícitamente fuera de scope el rediseño del tab "Ciclos Teóricos" ("si se quiere app-like, es spec aparte"). El owner ahora lo pide, y además reportó un bug: al cambiar al tab Ciclos, "el posicionamiento del tab también cambia".

**Persona afectada:** Admin y Secretaria (gestión de ciclos teóricos / envío de enlaces Zoom).

**Problema que resuelve:**
1. **Bug de shift de tabs:** el tab Prácticas es fill-screen (no scrollea la página, sin scrollbar); el tab Ciclos scrollea la página (aparece scrollbar de ~15px en Windows). Al alternar tabs, la aparición/desaparición del scrollbar corre todo el contenido —incluida la fila de tabs— horizontalmente. Es un layout shift visible y molesto.
2. **Inconsistencia de layout:** Ciclos es la única parte de la página que no es app-like (scroll de página vs. fill-screen), rompiendo la coherencia lograda en 0028/0029/0030.

**Hipótesis de valor:** aplicar el mismo patrón fill-screen a Ciclos elimina el shift de tabs de raíz (sin scroll de página no hay scrollbar que aparezca/desaparezca) y completa la coherencia app-like de la página, reutilizando el canon existente (`--fill-screen-kpi`, container-based tier), sin SCSS nuevo del grid.

---

## 2. User Stories

- **US1**: Como admin/secretaria, quiero que al cambiar entre los tabs Prácticas y Ciclos la fila de tabs (y todo el contenido) NO se mueva horizontalmente, para no percibir un salto visual molesto.
- **US2**: Como admin/secretaria en **desktop**, quiero que el tab Ciclos sea app-like (sin scroll de página; las columnas de Clases y Alumnos scrollean internamente), igual que el tab Prácticas y el resto de la app.
- **US3**: Como admin/secretaria en **móvil / con drawer abierto**, quiero que las dos columnas de Ciclos apilen y la página scrollee natural, con el mismo criterio por-contenedor (no viewport) que el tab Prácticas.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given el tab Prácticas activo en desktop, When se cambia al tab Ciclos y de vuelta, Then la fila de tabs no cambia su posición horizontal (ni el resto del contenido) — no aparece/desaparece scrollbar de página en ninguno de los dos tabs.
- **AC2**: Given desktop 1440×900+ con un ciclo seleccionado y el tab Ciclos activo, When se renderiza, Then `.shell-content` no scrollea; el selector de ciclo queda fijo arriba y las columnas "Clases del ciclo" y "Alumnos del ciclo" llenan el resto del alto con scroll interno propio cada una.
- **AC3**: Given desktop con más de 6 clases o un roster largo, When se scrollea dentro de una columna, Then solo esa columna scrollea (la otra columna y el selector permanecen fijos).
- **AC4**: Given `<main>` angostado (drawer lateral abierto o tablet/móvil), When el tab Ciclos está activo, Then las dos columnas apilan (1 columna) y la página scrollea natural — el switch usa el mismo criterio por-contenedor (`isDesktopLayout`) que el tab Prácticas, NO el breakpoint de viewport `lg:`.
- **AC5**: Given la implementación, When se revisa el diff, Then `_bento-grid.scss` no cambia (se reutiliza `--fill-screen-kpi` aplicándolo también al tab Ciclos).

### Edge cases obligatorios

- **AC-E1**: Given ningún ciclo seleccionado (o cero ciclos en la sede), When el tab Ciclos está activo, Then se muestra el estado vacío/selector sin romper el fill (no aparece scroll de página en desktop).
- **AC-E2**: Given estado loading del ciclo, Then los skeletons respetan el fill (no provocan scroll de página en desktop).
- **AC-E3**: Given el panel de "Elegir destinatarios" abierto dentro de una clase, When se despliega, Then funciona igual que antes (su propio `max-h-48 overflow-y-auto` interno se mantiene) dentro de la columna scrolleable.

---

## 4. Out of scope

- ❌ Rediseño funcional del flujo de ciclos (envío Zoom, reasignación de alumnos) — solo layout.
- ❌ Cambios al tab Prácticas (ya cerrado en 0030).
- ❌ `scrollbar-gutter: stable` global en `.shell-content` — sería un fix universal del shift para toda la app, pero toca CSS compartido del shell; queda como nota/propuesta aparte. Esta spec resuelve el shift solo para esta página vía fill-screen.
- ❌ Cambios de BD/RLS/modelos/facades.

---

## 5. Dependencias

### Specs previas
- 0028 (canon `.bento-fill`, tier por contenedor), 0029 (`--fill-screen-kpi`), 0030 (patrón 2 columnas + `isDesktopLayout` en `asistencia-clase-b-content`).

### Capacidades existentes
- `asistencia-clase-b-content` (parent) con `isDesktopLayout()` ya computado.
- `ciclos-teoricos-content` (child) con layout de 2 columnas ya presente (roster ya scrollea internamente).
- `--fill-screen-kpi` en `_bento-grid.scss` (sin cambios).

### Capacidades nuevas
- Ninguna de infraestructura. Input nuevo `isDesktop` (o similar) en `ciclos-teoricos-content` para recibir el criterio por-contenedor desde el parent.

---

## 6. Datos y modelo

N/A — sin cambios de persistencia.

---

## 7. UX y flujos

- Pantalla(s): `/app/admin/asistencia` y `/app/secretaria/asistencia`, tab Ciclos Teóricos.
- Desktop: hero (fila 1) → tabs (fila 2) → celda fill (fila 3) = selector arriba (shrink-0) + 2 columnas (flex-1, scroll interno cada una).
- Móvil / drawer: apila, scroll natural de página.

---

## 8. Métricas de éxito

- Cero shift horizontal de la fila de tabs al alternar tabs.
- Tab Ciclos sin scroll de página en desktop (paridad con Prácticas).

---

## 9. Notas / decisiones

- [x] Reutilizar `--fill-screen-kpi` aplicándolo a AMBOS tabs (el modificador deja de ser condicional por tab) → 3 filas fijas siempre: hero/tabs/fill. La celda fill es el contenido del tab activo.
- [x] El switch col/row de Ciclos usa el criterio por-contenedor (`isDesktopLayout` del parent, pasado como input), NO `lg:` de viewport — mismo fix de consistencia que la 2ª ronda de la 0030.
- [x] La columna "Clases del ciclo" (6 tarjetas altas) recibe scroll interno; el roster ya lo tiene.
- [ ] `ciclos-teoricos-content` es Dumb: el host debe comportarse como celda fill (display flex column). Confirmar en implementación que `contain:size` de `.bento-fill` sobre el host de un componente Angular funciona (host necesita `display:flex`).

---

## Changelog

- 2026-07-13 — spec creada + aprobada por el owner (continuación directa de 0030, con análisis visual previo del tab Ciclos y confirmación del bug de shift por scrollbar).
- 2026-07-13 — implementada, verificada, cerrada (acceptance.md) → status `done`.
- 2026-07-13 — refinamiento del owner: fusión del selector de ciclo en el header de la columna Clases (recupera ~140px, Clases +72% visible) + migración del badge a `<app-badge>` (ARCH-15). Ver acceptance.md §"Refinamiento post-cierre". → sigue `done`.
