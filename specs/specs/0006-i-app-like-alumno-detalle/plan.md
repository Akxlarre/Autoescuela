# Plan 0006-i — App-like: Ficha de Alumno (`/admin/alumnos/:id` + `/secretaria/alumnos/:id`)

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-08-28
> **Talla:** L — advertencia explícita: revisar este plan con cuidado antes de implementar.
> Justificación: por conteo mecánico de archivos (1 solo componente modificado, sin facade
> nuevo, sin migración) calificaría S/M, pero la propia Asignación de origen (ASG-b-085) marca
> esta pieza como "la más grande y riesgosa del rollout" — página de mayor tráfico del sistema,
> 1660 líneas, 2 rutas (`/admin` y `/secretaria`), dual-mode (Clase B / Profesional), y un
> checklist de cierre deliberadamente más exigente que el resto del rollout (QA visual en 2
> rutas × 3 viewports × 4 tabs + sign-off humano). El riesgo real no está en el volumen de
> archivos sino en la superficie de regresión.

---

## 1. Resumen ejecutivo

Reestructurar `AdminAlumnoDetalleComponent` de un layout de 3 columnas fijas (que scrollea como
documento normal) a 4 pestañas (Ficha / Matrículas / Pagos / Clases) con el patrón app-like ya
validado en `fix-027-i` (ficha de instructor, mismo tipo de página) — `<app-tabs
variant="segmented">` + un único panel `.bento-fill` con `@switch`. El botón "Documentos" se
agrega junto a "Editar Perfil" en el header (no es pestaña), reutilizando
`DmsFacade.openStudentDocsDrawer()` que ya existe completo. Orden: (1) catalogar el 100% de
acciones/secciones actuales, (2) armar el shell de tabs vacío, (3) migrar contenido tab por
tab sin tocar lógica de negocio, (4) aplicar el fix del hueco vacío en tabs cortas y el ajuste
mobile ya conocidos de `fix-027-i`, (5) revertir el parche CSS viejo (líneas 830-841), (6)
`/verify` exhaustivo en ambas rutas.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.spec.ts` (extender, ya existe) | Test | Nuevos casos para `activeTab()`, `setActiveTab()` y la lógica de qué tab muestra qué (ver §7) |

No se crean componentes nuevos — el patrón de tabs y el drawer de documentos ya existen.

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts` | Reestructurar template completo: agregar `<app-tabs>` (Ficha/Matrículas/Pagos/Clases) + panel `.bento-fill` con `@switch`; mover el contenido de las 3 columnas fijas a cada `@case`; agregar botón "Documentos" junto a "Editar Perfil"; aplicar `--fill-screen-kpi` + `.bento-grid--rows-fit` en el grid raíz; revertir el override CSS de líneas 830-841 (ya no hace falta); agregar signal `activeTab` + método `setActiveTab()` | Núcleo del cambio — único archivo que requiere reestructuración real |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

> Salida del paso DESCUBRIR. Qué ya existe que vamos a aprovechar.

### Componentes existentes que reutilizamos
- `<app-tabs variant="segmented">` (`shared/components/tabs/tabs.component.ts`) — ya usado en
  esta misma página para el selector de matrícula (con `variant="pill"`) y en `fix-027-i` con
  `variant="segmented"` para las secciones internas. Mismo componente, variant distinto.
- `<app-admin-historial-pagos>` — se mueve del bento-grid principal al `@case` de la tab
  "Pagos", sin cambios internos (ya tiene `overflow-y-auto`/`flex-1 min-h-0` listos para vivir
  dentro de un `.bento-fill`).
- Todos los drawers existentes (Ver Contrato, Carnet, Certificado, Inasistencias, Ficha
  Técnica, Consentimientos, Reagendamientos, Reagendar Clases) — se mantienen sin cambios,
  solo cambia desde qué tab/botón se disparan.

### Facades/Services existentes que extendemos
- **Ninguno.** `AdminAlumnoDetalleFacade` ya expone todo lo necesario (dual-mode Clase
  B/Profesional, `certPdfPath`, historial de pagos, etc.) — este es un cambio 100% de
  presentación, cero lógica de negocio nueva.
- `DmsFacade.openStudentDocsDrawer(studentId, enrollmentId, name)` — ya existe completo (ver
  `indices/FACADES.md`), se invoca tal cual desde el nuevo botón "Documentos".

### Componentes/Facades que NO existen y debemos crear
- Ninguno.

---

## 4. Modelo de datos

N/A — sin cambios de persistencia, RLS, ni modelos DTO/UI. Reestructuración de presentación
pura sobre datos que el Facade ya expone.

---

## 5. Arquitectura del feature

### Diagrama de flujo (verbal)

```
AdminAlumnoDetalleComponent (Smart, sin cambios de inyección)
  ├─ inject(AdminAlumnoDetalleFacade)   [sin cambios]
  ├─ signal activeTab = signal<'ficha'|'matriculas'|'pagos'|'clases'>('ficha')  [NUEVO]
  ├─ <app-section-hero [actions]="headerActions()">  [+ botón Documentos]
  ├─ <app-tabs [tabs]="fichaTabs" [activeId]="activeTab()" variant="segmented"
  │            (activeIdChange)="setActiveTab($event)" />   [NUEVO]
  └─ <div class="bento-fill ..."> @switch (activeTab()) {
        @case ('ficha')      { <!-- Info Personal + acciones --> }
        @case ('matriculas') { <!-- selector de matrícula (ya existía) --> }
        @case ('pagos')      { <app-admin-historial-pagos ... /> }
        @case ('clases')     { <!-- Clases Prácticas (B) o Asistencia Teo/Prac (Prof) --> }
     } </div>
```

### Capas tocadas
- **Smart**: `features/admin/alumno-detalle/admin-alumno-detalle.component.ts` (único cambio real)
- **Dumb**: ninguno nuevo — `app-tabs`, `app-admin-historial-pagos` sin modificar
- **Facade**: ninguno — `AdminAlumnoDetalleFacade` y `DmsFacade` sin cambios
- **Migration**: N/A

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — OnPush ya aplicado, Signals ya en uso; sin violaciones nuevas esperadas
- [ ] `facades.md` — no aplica, sin cambios de Facade
- [ ] `models.md` — no aplica, sin cambios de modelos
- [x] `visual-system.md` — el corazón del cambio: patrón App-like (`--fill-screen-kpi`,
  `.bento-fill`, `.bento-grid--rows-fit`), reusar exactamente el combo documentado en
  `fix-027-i` (nota dejada explícitamente para esta pieza)
- [ ] `swr-pattern.md` — el Facade ya es SWR+Realtime, sin cambios en ese contrato; solo
  verificar AC-E2 (reset de scroll al llegar un evento Realtime mientras se está en una tab)
- [ ] `notifications.md` — no aplica
- [x] `testing-tdd.md` — `.spec.ts` obligatorio para la lógica nueva de `activeTab`/`setActiveTab`
  (es lógica de decisión: qué tab se activa, no un binding trivial)
- [ ] `ai-readability.md` — el botón nuevo "Documentos" debe llevar
  `data-llm-action="ver-documentos"` (mismo patrón que los botones vecinos ya lo tienen)

---

## 7. Plan de testing

- **Tests unitarios**: extender `admin-alumno-detalle.component.spec.ts` con casos para
  `activeTab()`/`setActiveTab()` (decisión de qué tab queda activa por default, y que cambiar
  de tab no dispara refetch innecesario del Facade).
- **Tests de integración**: no aplica (sin Facade nuevo).
- **QA manual (golden path + edge cases)**:
  - Golden path: abrir ficha de un alumno Clase B con historial largo de pagos → confirmar que
    la tab "Pagos" scrollea internamente, el documento no scrollea.
  - Alumno Profesional: confirmar que la tab "Clases" muestra Asistencia Teórica/Práctica/Nota
    Promedio correctamente dentro del nuevo layout.
  - Alumno con 2+ matrículas: confirmar que el selector de pills (tab "Matrículas") no choca
    visualmente con las 4 tabs nuevas.
  - `force-compact` con un drawer abierto (ej. Ficha Técnica) sobre cada una de las 4 tabs.
  - Mobile (375px): scroll nativo normal, sin fill-screen — confirmar que ninguna tab se ve
    rota ni con huecos (aplicar el fix ya conocido de `fix-027-i` si aparece el mismo síntoma).
  - `/verify` en **ambas rutas** (`/admin/alumnos/:id`, `/secretaria/alumnos/:id`), 390×844,
    1440×900 y 768 de alto, **en cada una de las 4 tabs**.
  - Captura antes/después confirmando que ninguna acción actual (editar perfil, ver contrato,
    carnet, certificado, inasistencias, ficha técnica, consentimientos, reagendamientos,
    reagendar clases penalizadas, documentos) se perdió.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Perder alguna acción/botón al mover contenido a tabs (componente de 1660 líneas, fácil pasar algo por alto) | Media | Catalogar el 100% de acciones ANTES de tocar el template (tarea explícita en tasks.md); captura antes/después obligatoria en el checklist de cierre |
| Angular no permite reusar `as detail`/`as alumno` bindeado en un `@case` distinto al que lo declaró | Alta (ya ocurrió en `fix-027-i`, con solo 2 tabs) | Re-bindear `@if (facade.alumno(); as alumno)` dentro de CADA `@case` que lo necesite, no una sola vez arriba del `@switch` |
| Hueco vacío en la tab "Ficha" (pocas cards, panel forzado a llenar toda la altura) | Alta (mismo síntoma ya visto en `fix-027-i` para la tab "Datos") | Aplicar directamente la clase `.ficha-datos-panel` con `@container layoutmain (min-width: 1024px)` + centrado vertical, mismo mecanismo ya resuelto |
| En mobile, la fila de `<app-tabs>` queda forzada a min 120px por `grid-auto-rows` base, dejando hueco debajo | Alta (mismo síntoma, mismo fix ya documentado) | Aplicar `.bento-grid--rows-fit` junto a `--fill-screen-kpi` en el grid raíz, exactamente como en `fix-027-i` |
| Regresión visual/funcional en una página de altísimo tráfico, notada de inmediato por el equipo | Alta si no se testea bien | Checklist de cierre reforzado ya definido en la Asignación original: QA visual en 2 rutas × 3 viewports × 4 tabs + sign-off humano del owner de producto antes de cerrar (no basta con ACs automáticos en verde — lección explícita de spec 0030) |
| Selector de matrícula (pills, ya existente) se solapa visualmente con las 4 tabs nuevas cuando el alumno tiene 2+ matrículas | Media | Verificar explícitamente este caso en QA manual (AC5); considerar si el selector de matrícula debería vivir DENTRO de la tab "Matrículas" en vez de arriba de todas las tabs — decisión a tomar durante implementación, no asumida acá |

---

## 9. Orden de implementación

1. Catalogar el 100% de acciones/secciones actuales del componente (lectura completa línea por
   línea, no solo lo ya explorado en discovery).
2. Escribir `.spec.ts` de `activeTab()`/`setActiveTab()` primero (TDD).
3. Armar el shell de tabs vacío (`<app-tabs variant="segmented">` + panel `.bento-fill` con
   `@switch` sin contenido, solo placeholders) y verificar que el layout base ya no scrollea
   como documento.
4. Migrar contenido tab por tab: Ficha → Matrículas → Pagos → Clases, sin tocar lógica de
   negocio, re-bindeando `as alumno`/`as detail` en cada `@case`.
5. Mover "Editar Perfil"/"Eliminar Alumno"/"Documentos" al header (Documentos es nuevo, resto
   ya estaba ahí).
6. Aplicar `.ficha-datos-panel` (centrado tab corta) y `.bento-grid--rows-fit` (mobile) según
   los gotchas ya conocidos.
7. Revertir el parche CSS de líneas 830-841 (ya no hace falta con `--fill-screen-kpi` activo).
8. `npm run test:ci` + `npm run lint:arch` limpios.
9. `/verify` exhaustivo (2 rutas × 3 viewports × 4 tabs) + captura antes/después de acciones.
10. QA visual con el owner de producto antes de cerrar — obligatorio por el checklist de la ASG.

---

## 10. Estimación

L — varias sesiones de trabajo, no una sola. El propio origen (ASG-b-085) ya lo advertía.

---

## Changelog

- 2026-08-28 — plan inicial, talla L confirmada por el usuario con justificación de riesgo (no
  de conteo de archivos)
