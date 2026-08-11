# Spec 0008 — App-like: matriz de notas (Evaluaciones profesional)

> **Status:** done
> **Created:** 2026-08-10
> **Owner:** m
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Asignación ASG-b-080 (specs/assignments/ASG-b-080-app-like-matriz-de-notas.md) —
paso 13 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`).

**Persona afectada:** Admin y Secretaria (dos rutas distintas para el mismo dominio funcional).

**Problema que resuelve:**
`AdminProfesionalEvaluacionesComponent` (828 líneas, ruta `/admin/clase-profesional/evaluaciones`)
y `SecretariaProfesionalNotasComponent` (758 líneas, ruta `/secretaria/profesional/notas`) son
casi-clones exactos — mismo CSS sticky inline, mismo modo dual "aterrizaje"/"grilla" — que hoy
divergen en tres formas que confunden al usuario y generan deuda: (1) ninguno de los dos sigue el
patrón app-like (fill-screen desktop / scroll interno), (2) tienen un bug de UI concreto en
secretaria — el badge de estado de curso ("Sin iniciar") no separa ícono y texto porque falta el
wrapper `<span class="inline-flex items-center gap-1">` que sí existe en admin — y (3) el nombre
del feature está fragmentado en tres formas distintas en el código: label de menú admin dice
"Evaluaciones" (`menu-config.service.ts:96`), label de menú secretaria dice "Calificaciones"
(`menu-config.service.ts:223`), y las rutas usan `/evaluaciones` vs `/notas`.

**Decisión de nomenclatura (confirmada por el owner):** el nombre canónico es **"Evaluaciones"**,
porque es el término que usa el libro de clases oficial del rubro (registro exigido por la
normativa de escuelas de conductores). Esta spec unifica labels de menú, título de página, Y
rutas/URLs de ambos componentes a `evaluaciones`.

**Hipótesis de valor:**
Un solo nombre y un solo comportamiento visual para el mismo feature en las dos rutas elimina
confusión de terminología entre roles, corrige un bug visible, y suma la matriz de notas al
rollout app-like (mejor uso del alto de pantalla en desktop, sin romper el scroll bidireccional
sticky ya construido a mano).

---

## 2. User Stories

- **US1**: Como Admin o Secretaria, quiero que la matriz de notas de Clase Profesional aproveche
  el alto completo de la pantalla en desktop (sin scrollear la página, solo el contenido interno)
  para ver más grupos/cursos sin perder tiempo scrolleando.
- **US2**: Como Admin o Secretaria, quiero que la pantalla de matriz de notas se comporte y se vea
  exactamente igual sin importar desde qué rol la abra, para no tener que reaprender la interfaz
  ni encontrar inconsistencias visuales entre un rol y otro.
- **US3**: Como Secretaria, quiero que el badge de estado del curso ("Sin iniciar", "En edición",
  "Confirmada") muestre el ícono y el texto separados, igual que en Admin, para poder leerlo sin
  esfuerzo.
- **US4**: Como cualquier usuario del sistema, quiero que el feature se llame "Evaluaciones" en
  todas partes (menú, título de página, URL) porque es el término que usa el libro de clases
  oficial, para no confundirme con nombres distintos ("Calificaciones", "Notas") para lo mismo.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given un Admin o Secretaria en viewport desktop (≥1024px) con datos que exceden el alto
  de la pantalla, When entra a la pantalla de matriz de notas en modo "aterrizaje" (grupos de
  promoción), Then el shell ocupa 100vh sin scroll de documento y el listado de grupos scrollea
  internamente dentro de su propio contenedor `.bento-fill`.
- **AC2**: Given un Admin o Secretaria en viewport desktop con una grilla de notas abierta (modo
  "grilla"), When la cantidad de alumnos y/o módulos excede el alto/ancho visible, Then el shell
  ocupa 100vh sin scroll de documento, y el scroll bidireccional existente (header sticky + columna
  de alumno sticky) sigue funcionando exactamente igual que antes del cambio.
- **AC3**: Given viewport mobile/tablet (<1024px), When se accede a cualquiera de los dos modos en
  cualquiera de las dos rutas, Then la página revierte a scroll nativo normal (sin fill-screen),
  igual que el resto del rollout app-like.
- **AC4**: Given el componente de Admin y el de Secretaria renderizando el mismo estado de datos
  (mismo curso, mismo modo), When se comparan visualmente lado a lado, Then el markup, spacing,
  colores, badges e interacciones son indistinguibles entre ambos — cualquier diferencia visual
  encontrada se corrige, no se documenta como "aceptable".
- **AC5**: Given la vista de secretaria mostrando el badge de estado de un curso, When se
  renderiza cualquier estado ("Sin iniciar", "En edición", "Confirmada"), Then el ícono y el texto
  del badge están visualmente separados (mismo `gap` que en Admin), igual que
  `admin-profesional-evaluaciones.component.ts:191-196`.
- **AC6**: Given cualquier rol con acceso al feature, When navega por el menú lateral, Then el
  label dice "Evaluaciones" tanto en el menú de Admin como en el de Secretaria (no "Calificaciones").
- **AC7**: Given la ruta de secretaria, When se navega a la sección, Then la URL es
  `/secretaria/profesional/evaluaciones` (ya no `/profesional/notas`), sin redirect desde la URL
  vieja (decisión del owner: sistema interno, navegación siempre por menú).
- **AC8**: Given el título/fallback de la página cuando no hay curso seleccionado, When se
  renderiza en secretaria, Then dice "Evaluaciones" (no "Calificaciones"), igual que el
  comportamiento equivalente en admin.

### Edge cases obligatorios

- **AC-E1**: Given el modo "aterrizaje" con una cantidad variable de N grupos de promoción
  (0, 1, y un número grande que exceda claramente el alto de pantalla), When se renderiza en
  desktop, Then el criterio de densidad elegido (scroll compartido vs. límite + "cargar más") se
  aplica de forma consistente y con tests de densidad si se introduce lógica nueva.
- **AC-E2**: Given un drawer abierto sobre cualquiera de los dos modos (aterrizaje o grilla),
  When se ejecuta el check de `force-compact`, Then el layout no se rompe ni genera overflow
  doble (checklist estándar del rollout app-like).
- **AC-E3**: Given cualquier referencia de código a la ruta vieja `/profesional/notas` o al label
  "Calificaciones" (`menu-config.service.ts`, `secretaria-profesional-notas.component.ts`),
  When se completa la spec, Then no queda ninguna referencia residual (grep limpio).

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Renombrar la ruta de admin (`/admin/clase-profesional/evaluaciones`) — ya usa el nombre
  canónico "evaluaciones", no requiere cambio.
- ❌ Renombrar el archivo/carpeta física `secretaria/profesional-notas/` a
  `profesional-evaluaciones/` — puede evaluarse como limpieza aparte si el plan lo justifica, pero
  no es un requisito de esta spec (el contrato es sobre nombre visible al usuario y URL, no sobre
  la organización interna de carpetas).
- ❌ Extraer un componente compartido único (`shared/`) que reemplace ambos casi-clones — la spec
  exige paridad visual/funcional total, pero la decisión de si se logra por convergencia manual de
  2 archivos o por extracción a un componente compartido queda para `plan.md`, no está decidida
  aquí de antemano.
- ❌ Redirect desde la URL vieja `/secretaria/profesional/notas` — decisión explícita del owner de
  no mantenerlo (ver AC7).

---

## 5. Dependencias

### Specs previas
- Ninguna. Depende del patrón app-like ya consolidado en el rollout (`.bento-fill`,
  `--fill-screen-kpi`, `LayoutService.tier()`), no de una spec específica pendiente.

### Capacidades del proyecto que se asumen existentes
- `EvaluacionesProfesionalFacade` (modelo de datos ya expone `notas`, `alumnosConNotas`, etc. —
  no se toca el Facade en esta spec, solo el nombre visible al usuario).
- `app-badge`, `app-icon`, `BentoGridLayoutDirective`, `LayoutService.tier()`.

### Capacidades nuevas requeridas
- Ninguna a nivel de datos/BD. Solo cambios de ruta (`app.routes.ts`), labels de menú
  (`menu-config.service.ts`) y CSS/template en ambos componentes.

---

## 6. Datos y modelo (preliminar)

> Solo si el feature toca persistencia. Detalle técnico final va en `plan.md`.

- Tablas nuevas / modificadas: …
- Modelos UI nuevos: …
- RLS requerida: …

---

## 7. UX y flujos (preliminar)

> Solo a nivel de wireframe verbal. Detalle visual va con el diseñador/DS.

- Pantalla(s) afectada(s): …
- Flujo principal (happy path): …
- Estados especiales (loading, error, vacío): …

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- {{métrica 1}}
- {{métrica 2}}

---

## 9. Notas / decisiones abiertas

- [ ] {{pregunta pendiente para el usuario}}
- [ ] {{decisión a tomar antes de planificar}}
- Originado de Asignación ASG-b-080 (specs/assignments/ASG-b-080-app-like-matriz-de-notas.md)

---

## Changelog

- 2026-08-10 — draft inicial por m
- 2026-08-10 — User Stories, AC y Out of scope redactados y aprobados por el owner
