# Spec 0006-i — App-like: Ficha de Alumno (`/admin/alumnos/:id` + `/secretaria/alumnos/:id`)

> **Status:** draft
> **Created:** 2026-08-28
> **Owner:** i
> **Priority:** P2 (marcada Alta en la tabla de ASSIGNMENTS.md, P2 en el frontmatter de la
> Asignación original — inconsistencia detectada, no resuelta acá, dejar constancia)

---

## 1. Contexto de negocio

**Origen:** ASG-b-085 (`specs/assignments/ASG-b-085-app-like-alumnos-id.md`), segunda mitad del
paso 16 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`). Prerequisito ASG-b-084 (piloto de
tabs en `instructor/alumnos/:id/ficha`) ya resuelto vía `fix-027-i`.

**Persona afectada:** Secretaria y Admin — es la ficha de alumno que ambos roles abren más veces
al día (matrículas, pagos, documentos, clases).

**Problema que resuelve:** `AdminAlumnoDetalleComponent` (1660 líneas, compartido entre
`/admin/alumnos/:id` y `/secretaria/alumnos/:id`, sirve tanto a alumnos Clase B como
Profesional vía `licenseGroup`) no sigue el contrato app-like del proyecto. El grid raíz **no**
aplica ningún modificador `--fill-screen` — solo hay un parche CSS puntual (documentado en
líneas 830-841 del componente) que corrige el alto de la primera fila, nada más. Como
consecuencia, toda la página scrollea como documento normal en vez de scrollear internamente
por sección. El síntoma más visible: `AdminHistorialPagosComponent` (columna de pagos) ya tiene
el código listo para scroll interno (`overflow-y-auto`, `flex-1 min-h-0`), pero como su
contenedor padre no le da una altura acotada, un alumno con muchos pagos estira la página
entera en vez de scrollear solo esa columna.

**Hipótesis de valor:** reestructurar la ficha en pestañas (Ficha / Matrículas / Pagos / Clases)
con `--fill-screen` + `.bento-fill` por pestaña resuelve el problema de raíz (no solo el síntoma
de pagos) y deja la página de mayor tráfico del sistema alineada al mismo patrón ya validado en
Libro de Clases (spec 0005-i) y la ficha de instructor (`fix-027-i`).

---

## 2. User Stories

- **US1**: Como Secretaria/Admin, quiero que la ficha de un alumno con muchos pagos/clases no
  estire la página entera, para poder navegar la información sin scroll interminable de
  documento.
- **US2**: Como Secretaria/Admin, quiero moverme entre Ficha/Matrículas/Pagos/Clases con
  pestañas claras, para encontrar lo que busco sin tener que escanear una página larguísima.
- **US3**: Como Secretaria/Admin, quiero seguir teniendo acceso a TODAS las acciones que existen
  hoy (editar perfil, ver contrato, carnet, certificado, inasistencias, ficha técnica,
  consentimientos, reagendamientos, documentos), sin que ninguna se pierda al reorganizar en
  pestañas.
- **US4**: Como Admin/Secretaria viendo un alumno Profesional, quiero que la vista de
  Asistencia Teórica/Práctica/Nota Promedio se comporte igual de bien en el nuevo layout que la
  vista de Clases Prácticas de un alumno Clase B.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given un alumno con 12 clases prácticas completas Y varios pagos registrados,
  When se abre su ficha en desktop (≥1024px), Then el documento NO scrollea — cada pestaña
  scrollea internamente dentro de su propio panel `.bento-fill`.
- **AC2**: Given la ficha de un alumno abierta, When se hace click en cada una de las 4 pestañas
  (Ficha / Matrículas / Pagos / Clases), Then el contenido correspondiente se muestra sin perder
  ningún dato ni acción que existía en la versión de columnas fijas.
- **AC3**: Given el botón "Editar Perfil" en el header, When se agrega el nuevo botón
  "Documentos", Then aparece en el mismo contenedor de acciones (junto a Editar Perfil), abre un
  drawer con los documentos del alumno vía `DmsFacade`, y NO se convierte en una pestaña.
- **AC4**: Given un alumno con `licenseGroup = 'professional'`, When se abre su ficha, Then las
  secciones Asistencia Teórica / Asistencia Práctica / Nota Promedio se ven correctamente dentro
  del nuevo layout de pestañas, con el mismo comportamiento que tenían en columnas fijas.
- **AC5**: Given un alumno con 2+ matrículas (selector de pills existente), When se abre su
  ficha, Then el selector de matrícula convive sin solaparse visualmente con las 4 pestañas
  nuevas.
- **AC6**: Given la ficha se abre en mobile (<640px), When se navega, Then el scroll nativo de
  página funciona normalmente (comportamiento correcto para mobile, no rompe nada del patrón
  app-like existente).

### Edge cases obligatorios

- **AC-E1**: Given un drawer lateral abierto (ej. Ficha Técnica) sobre la ficha en modo
  `force-compact`, When se redimensiona o interactúa, Then el layout de pestañas no se rompe
  (verificar `force-compact` con drawer abierto explícitamente, por checklist de la ASG
  original).
- **AC-E2**: Given un alumno recién cargado con datos que llegan por Realtime/SWR mientras el
  usuario está en la pestaña "Pagos" con scroll bajado, When llega una actualización, Then el
  scroll de esa pestaña no se resetea de forma disruptiva (ítem "Edge cases estresados" #6 de
  `indices/APP-LIKE-ROLLOUT.md`).
- **AC-E3**: Given el alumno tiene 0 pagos registrados o 0 clases, When se abre la pestaña
  correspondiente, Then se muestra un estado vacío correctamente centrado (no una celda vacía
  pegada arriba), replicando el criterio ya establecido en `visual-system.md` §"Estados vacíos y
  skeletons dentro de un `.bento-fill`".

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Construir una pestaña/sección "Documentos" — se resuelve como botón de acción junto a
  "Editar Perfil" (decisión explícita del owner de producto en esta sesión), no como pestaña.
- ❌ Cambiar la lógica de negocio de elegibilidad, penalización, o cálculo de progreso — solo se
  reestructura el layout visual, no los datos ni las reglas.
- ❌ Tocar el listado de alumnos (`admin-alumnos.component.ts` / `secretaria-alumnos.component.ts`)
  — fuera de alcance, ya resuelto en asignaciones previas del rollout.
- ❌ Rediseñar los drawers existentes (Ver Contrato, Carnet, Inasistencias, Ficha Técnica,
  Consentimientos, Reagendamientos) — se mantienen tal cual, solo cambia dónde vive el botón que
  los abre.

---

## 5. Dependencias

### Specs previas
- `fix-027-i-app-like-instructor-ficha-tabs` (ASG-b-084) — patrón de tabs a reusar, ya `done`.
- Spec 0005-i (Libro de Clases) — segundo precedente de tabs + `--fill-screen` en este mismo
  ciclo de trabajo, útil como referencia adicional.

### Capacidades del proyecto que se asumen existentes
- `<app-tabs>` (`@shared/components/tabs/tabs.component.ts`) — ya se usa en esta misma página
  para el selector de matrícula.
- `DmsFacade` — ya existe y se usa en otros módulos para documentos por alumno/matrícula.
- `LayoutService.tier()` / `sliceByBudget` (`core/utils/layout-tier.utils.ts`) — si alguna
  pestaña necesita densidad adaptativa.

### Capacidades nuevas requeridas
- Ninguna tabla ni endpoint nuevo — es 100% reestructuración de UI sobre datos que el
  `AdminAlumnoDetalleFacade` ya expone.

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: ninguna.
- Modelos UI nuevos: ninguno esperado — el catálogo de acciones y secciones se lee del propio
  componente actual, no requiere nuevos DTOs/UI models.
- RLS requerida: no aplica (sin cambios de datos).

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): `/admin/alumnos/:id`, `/secretaria/alumnos/:id` (mismo componente,
  ambas rutas).
- Flujo principal (happy path): abrir ficha → header con Editar Perfil / Documentos / Eliminar
  Alumno → 4 pestañas (Ficha, Matrículas, Pagos, Clases) → cada una con su `.bento-fill`.
- Estados especiales: loading (skeleton ya existente, adaptar a la nueva estructura de pestañas),
  error (ya existente), vacío por pestaña (ver AC-E3).

---

## 8. Métricas de éxito post-launch

- Cero regresiones reportadas en Paquete 2 del UAT (matrícula/alumnos) tras el cambio — ya
  cubierto extensamente en `docs/UAT-PLAN.md`, re-correr ese paquete como regresión antes de
  cerrar.
- Ficha de alumno con historial de pagos largo no genera scroll de documento en desktop.

---

## 9. Notas / decisiones abiertas

- [x] ¿Dónde va "Documentos"? → Resuelto: botón de acción junto a "Editar Perfil" en el header,
  no pestaña (decisión del owner, 2026-08-28).
- [ ] Catalogar el 100% de las acciones/botones actuales del componente antes de tocar el
  template — tarea explícita de `plan.md`/`tasks.md`, no asumir que la lista de esta spec ya es
  exhaustiva.
- [ ] Confirmar si el checklist de cierre exigido por la ASG original (QA visual con el owner de
  producto, capturas antes/después) se ejecuta como parte de `/spec-verify` o como paso manual
  adicional antes de marcar `done`.
- Originado de Asignación ASG-b-085 (specs/assignments/ASG-b-085-app-like-alumnos-id.md)

---

## Changelog

- 2026-08-28 — draft inicial por i, a partir de ASG-b-085 y sesión de discovery en vivo
  (lectura de código real, confirmación de rutas compartidas, decisión de ubicación de
  Documentos).
