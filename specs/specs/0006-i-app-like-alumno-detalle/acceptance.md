# Acceptance 0006-i — App-like: Ficha de Alumno (`/admin/alumnos/:id` + `/secretaria/alumnos/:id`)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-08-30
> **Verifier:** Claude Sonnet 5 · QA visual del owner: 1ª pasada (4 tabs) **rechazada**, ajuste
> aplicado y re-verificado en vivo; **visto bueno final de la 2ª pasada pendiente de confirmar**

---

## Resumen

- AC totales: 9 (AC1-AC6 + AC-E1 a AC-E3)
- AC cumplidos: 9
- AC fallidos: 0
- AC con evidencia: 9 (verificación en vivo con Playwright MCP + tests + build)

**Veredicto final:** ✅ PASA (evidencia técnica/automática completa; falta la confirmación
explícita del owner sobre la 2ª pasada de diseño — capturas ya enviadas, esperando respuesta)

**Nota de proceso importante:** la primera pasada (4 tabs: Ficha/Matrículas/Pagos/Clases, botones
de acción como lista de texto apilada) fue **rechazada por el owner en QA visual** ("no me gustó
el diseño con el navegador arriba... por cómo quedaron los botones" + "Matrícula no tiene mucho
sentido, mucha página para tan poco"). Tras confirmar 2 decisiones explícitas con el owner, se
ajustó a **3 tabs** (Matrículas fusionada dentro de Ficha) y los botones a un **grid de tiles
ícono+label**. Los AC de abajo se verifican contra el diseño final (post-ajuste), no contra la
primera pasada — el espíritu de AC2/AC5 (navegación por pestañas sin perder datos/acciones, sin
solape con el selector de matrícula) se sostiene igual con 3 tabs que con 4; el número "4" en el
texto literal de la spec quedó desactualizado por la propia iteración de diseño que la spec pedía
validar con QA visual.

---

## Verificación por AC

### AC1 — Documento no scrollea en desktop, cada tab scrollea internamente

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: root `.bento-grid.bento-grid--fill-screen-kpi.bento-grid--rows-fit` +
    `.bento-fill` en el panel de tabs (`admin-alumno-detalle.component.ts`).
  - QA manual (T5.2, sesión 2026-08-29): `documentScrolls === false` confirmado por
    `browser_evaluate` en 1440×900 y en 1280×768, ambas rutas, Clase B y Profesional.
  - Panel de "Pagos" scrollea internamente por construcción (`overflow-y-auto` alrededor de
    `@for (pago of pagos(); track pago.id)`, sin desmontarse — ver AC-E2).
- **Notas:** —

### AC2 — Navegar entre pestañas sin perder datos ni acciones

- **Estado:** ✅ cumplido (con desviación de diseño documentada: 3 tabs, no 4)
- **Evidencia:**
  - T1.1: catálogo completo de las acciones/secciones originales (línea por línea, 1660
    líneas leídas).
  - T5.3 (sesión 2026-08-30): confirmado en vivo 1:1 que las 9 acciones catalogadas siguen
    existiendo y funcionando tras la migración: Editar Perfil, Documentos, Eliminar Alumno,
    Ver Contrato, Generar Carnet, Certificado, Inasistencias, Ficha Técnica, Consentimientos,
    Reagendamientos.
  - 34/34 tests verdes (`admin-alumno-detalle.component.spec.ts`), incluyendo el test nuevo
    que confirma que `setActiveTab('matriculas')` (tab eliminada en el ajuste post-QA) no
    rompe el signal.
- **Notas:** el owner rechazó "Matrículas" como 4ª tab independiente en QA visual — se fusionó
  dentro de "Ficha". Verificado en vivo que sus badges de contrato/certificado/carnet siguen
  presentes (ahora en la sección "MATRÍCULAS" de la tab Ficha), sin pérdida de información.

### AC3 — Botón "Documentos" en el header, no como pestaña

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `heroActions()` computed: `{ id: 'ver-documentos', label: 'Documentos', icon: 'folder',
    primary: true }` — cae en `headerActions()`, junto a "Editar Perfil".
  - `openDocumentosPanel()` → `dmsFacade.openStudentDocsDrawer(studentId, enrollmentId,
    nombre)` — reutiliza el drawer de DMS existente sin código nuevo.
  - Screenshots en vivo (T5.2, T5.5): "Documentos" visible en el header junto a "Editar
    Perfil" y "Eliminar Alumno", en las 3 tabs (no es un tab).
- **Notas:** —

### AC4 — Alumno Profesional: Asistencia Teórica/Práctica/Nota Promedio en el nuevo layout

- **Estado:** ✅ cumplido
- **Evidencia:**
  - T3.4: dual-mode (Clase B / Profesional) migrado a `@case ('clases')`.
  - T5.2: verificado en vivo con `/admin/alumnos/143` (Profesional) — Asistencia
    Teórica/Práctica/Nota Promedio funcionando dentro del mismo layout de tabs.
- **Notas:** —

### AC5 — Selector de matrícula (2+ enrollments) sin solape con las pestañas

- **Estado:** ✅ cumplido (verificado contra 3 tabs, no 4 — ver nota de AC2)
- **Evidencia:**
  - Selector de pills queda fuera del `@switch`, arriba de las tabs (decisión T1.2).
  - Override CSS scoped `.bento-grid--fill-screen-kpi.has-enrollment-selector` (4 filas:
    hero/selector/tabs/panel).
  - T5.2 y sesión 2026-08-30: verificado en vivo con `student_id=93` (2 matrículas,
    Profesional A2 + Clase B) en 1280×900 y 1280×1000 — selector limpiamente separado de las
    tabs, sin solape, en ambas pasadas de diseño (4 tabs y 3 tabs).
- **Notas:** —

### AC6 — Mobile (<640px): scroll nativo funciona normalmente

- **Estado:** ✅ cumplido
- **Evidencia:**
  - T5.2: `shellScrollHeight (1061) > shellClientHeight (768)` → `true` en 390×844.
  - Sesión 2026-08-30: re-verificado tras el ajuste post-QA en 390×844 — grid de tiles 2
    columnas, sección Matrículas legible, scroll nativo del `.shell-content` funcionando.
- **Notas:** —

### AC-E1 — `force-compact` con drawer abierto

- **Estado:** ✅ cumplido
- **Evidencia:** T5.2 — verificado con drawer "Ficha Técnica" abierto sobre la tab Ficha:
  colapsa a una columna sin romper el header ni las tabs.
- **Notas:** —

### AC-E2 — Scroll de "Pagos" no se resetea con Realtime/SWR

- **Estado:** ✅ cumplido
- **Evidencia:** T5.4 — verificado estructuralmente en
  `admin-historial-pagos.component.ts:53-61`: el contenedor `overflow-y-auto` envuelve
  directamente `@for (pago of pagos(); track pago.id)` sin ningún `@if` que lo desmonte; con
  `track`, un refresh SWR hace patching in-place sin destruir el scroll container.
- **Notas:** verificación estructural en vez de simular un evento Realtime en vivo — el
  mecanismo (`track` + wrapper permanente) hace la garantía verificable por construcción.

### AC-E3 — Estados vacíos centrados dentro de `.bento-fill`

- **Estado:** ✅ cumplido
- **Evidencia:** estado vacío de "Matrículas" (`@else` del `@for` de enrollments, ahora dentro
  de la tab Ficha) usa `flex-1 flex flex-col items-center justify-center`, siguiendo el
  criterio de `visual-system.md` §"Estados vacíos y skeletons dentro de un `.bento-fill`".
- **Notas:** —

---

## Out-of-scope respetado

- ❌ Construir una pestaña "Documentos" — confirmado: quedó como botón de header, nunca tab.
- ❌ Cambiar lógica de negocio (elegibilidad, penalización, progreso) — confirmado: cero
  cambios a facades o cálculos, solo reestructuración de template/CSS.
- ❌ Tocar el listado de alumnos — confirmado: sin cambios en
  `admin-alumnos.component.ts`/`secretaria-alumnos.component.ts`.
- ❌ Rediseñar los drawers existentes (Contrato, Carnet, Inasistencias, Ficha Técnica,
  Consentimientos, Reagendamientos) — confirmado: se mantienen sin cambios internos, solo
  cambió el estilo del botón que los abre (de botón de texto a tile).

---

## Deuda técnica detectada

- Ninguna deuda nueva bloqueante. El bug preexistente de padding duplicado en mobile
  (encontrado y corregido en T5.2) no era deuda dejada por esta spec — se originó y se cerró
  en la misma sesión.

---

## Cambios en índices

- `indices/COMPONENTS.md` — entrada de `/app/admin/alumnos/:id` +
  `/app/secretaria/alumnos/:id` reescrita completa con el patrón final de 3 tabs.
- `indices/APP-LIKE-ROLLOUT.md` — fila de la familia "fichas de detalle de alumno" marcada
  `✅ Resuelto (spec 0006-i, 2026-08-30)`.
- `specs/ROADMAP.md` — spec movida de Backlog a Done.

---

## Post-mortem

- **Qué salió mejor de lo esperado:** el catálogo exhaustivo de acciones (T1.1) hizo que la
  migración de contenido (Fase 3) fuera mecánica y de bajo riesgo — cero acciones perdidas
  detectadas en la re-verificación de T5.3.
- **Qué fricciones encontramos:** el plan inicial (4 tabs, botones de texto) pasó todos los
  checks automáticos y `/verify` sin objeciones, pero no sobrevivió el juicio visual humano —
  confirma la lección de spec 0030 ("QA geométrico ≠ mirada humana"): ACs en verde no
  reemplazan mostrarle el render real al owner antes de dar la spec por cerrada.
- **Qué cambiaríamos en el siguiente ciclo SDD:** para páginas de alto tráfico como esta,
  presentar un mockup/captura de la propuesta de tabs ANTES de implementar toda la migración
  de contenido, no después — habría evitado reescribir la tab Matrículas completa.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando en CI (34/34, `npx vitest run .../alumno-detalle/`)
- [x] `lint:arch` limpio (T5.1)
- [x] Sin deuda crítica abierta

**Cerrado por:** i (owner del track) — pendiente confirmación final del owner de producto sobre
la 2ª pasada de diseño (capturas enviadas 2026-08-30)
**Fecha:** 2026-08-30
