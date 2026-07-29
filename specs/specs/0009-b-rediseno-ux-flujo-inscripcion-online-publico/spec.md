# Spec 0009-b — Rediseño UX del Flujo de Inscripción Online Público

> **Status:** approved
> **Created:** 2026-06-01
> **Owner:** Akxlarre
> **Priority:** P0

---

## 1. Contexto de negocio

**Origen:** Auditoría UX `docs/auditoria-flujo-inscripcion-online.md` + investigación `docs/research/ux-wizard-inscripcion-educativo.md` y `docs/research/ux-transicion-landing-checkout.md`.

**Persona afectada:** Alumno prospecto (usuario público anónimo) que llega desde las landing pages Astro (`webs/`) al wizard de inscripción Angular (`/inscripcion`).

**Problema que resuelve:**
El wizard actual es funcionalmente correcto pero su UI no convence y rompe la continuidad con las landing pages. Al hacer clic en "Inscribirme" desde la web (con identidad de marca fuerte por sede), el usuario aterriza en un wizard neutro y genérico: pierde el color de marca, no ve confirmación de qué eligió, el precio no aparece hasta el final, y no hay señales de confianza. La investigación documenta que la ruptura visual landing→checkout activa la heurística de phishing del usuario y que los costos no anticipados son la causa #1 de abandono (39–48%).

Además, el wizard actual incluye un **paso de selección de sede** que no debería existir: las landing pages son **empresas distintas** (dominios, logos y marca propios). La sede es la identidad/tenant con que el usuario llega predeterminado desde su landing, no una elección dentro del flujo. Exponer un selector "azul / roja" dentro del wizard confunde y filtra que ambas comparten backend.

**Modelo de entrada (decidido):**
- La **sede (`branchId`) es contexto obligatorio** que viene de la URL. NO hay paso de selección de sede.
- Sin `branchId` (o inválido) → pantalla de orientación con enlaces a los sitios de cada escuela, sin selector interno.
- El **tipo de licencia (Clase B / Profesional)** es el primer paso, y se **auto-resuelve y salta** si la sede ofrece una sola opción (ej. azul = solo Clase B) o si llega `courseId` en la URL.

**Hipótesis de valor:**
Un wizard rediseñado, coherente visualmente con las landing pages y con las mejores prácticas de checkout (contexto, precio temprano, confianza, continuidad de marca), reduce el abandono del flujo de compra online y aumenta la conversión de visitante→matrícula pagada.

---

## 2. User Stories

- **US1**: Como alumno prospecto que llega desde la landing, quiero que el wizard se vea coherente con la web que acabo de visitar (mismos colores de sede, mismo lenguaje visual), para sentir que sigo en el mismo sitio confiable y no fui redirigido a un tercero.
- **US2**: Como alumno prospecto que ya eligió curso en la web de mi escuela, quiero ver confirmado qué estoy comprando (curso + escuela + precio) apenas entro al wizard, sin que se me pregunte de nuevo a qué sede pertenezco, para tener certeza de que el sistema registró mi elección antes de empezar a llenar datos.
- **US3**: Como alumno prospecto, quiero saber el precio total desde el primer paso, para no encontrarme con un costo inesperado justo antes de pagar.
- **US4**: Como alumno prospecto, quiero ver señales claras de que el proceso es seguro y de la escuela real (logo, contacto WhatsApp, "sin cobros sorpresa"), para confiar en entregar mis datos y pagar.
- **US5**: Como alumno prospecto en mi teléfono, quiero saber en qué paso voy y cuántos faltan con nombres claros, para no perderme en un proceso de varios pasos.
- **US6**: Como alumno prospecto que pagó, quiero saber exactamente qué sigue y cómo contactar a la escuela, para sentirme acompañado después de la compra.
- **US7**: Como alumno prospecto que dejó la inscripción a medias, quiero retomarla sabiendo dónde quedé y hace cuánto, para continuar sin re-empezar.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente.

### Continuidad de marca

- **AC1**: Given el usuario llega a `/inscripcion?branchId=1`, When carga el wizard, Then los elementos de marca (botones primarios, barra de progreso, accents) usan el color de la sede 1 (tema azul); con `?branchId=2` usan el tema rojo.
- **AC2**: Given el wizard rediseñado, When se compara visualmente con la landing Astro de la misma sede, Then comparte lenguaje visual coherente (tipografía, escala tipográfica, estilo de cards, tratamiento del color de marca, fondo).

### Confirmación de contexto y precio

- **AC3**: Given el usuario tiene sede y curso resueltos (por `courseId` en URL o tras elegir el tipo de licencia), When se renderiza el paso de datos personales, Then se muestra un banner/card de contexto con nombre del curso + escuela + precio total, ubicado **antes** del primer campo del formulario.
- **AC4**: Given el banner de contexto está visible, When el usuario hace clic en "Editar selección", Then puede cambiar el curso/tipo de licencia dentro del wizard (sin salir a la web ni perder la sesión). La **sede no es editable** (es el tenant de la escuela desde la que entró).
- **AC5**: Given el usuario está en datos personales o cualquier paso posterior (Clase B), When observa el banner de contexto, Then el precio total del curso es visible (NO aparece por primera vez en el resumen pre-pago).

### Entrada por sede (tenant) — sin paso de selección de sede

- **AC6**: Given el usuario llega con `?branchId=N` válido, When carga el wizard, Then NO se muestra ningún paso de selección de sede; la escuela queda fijada como contexto (tematización + banner) y el flujo arranca en la selección de tipo de licencia o en datos personales.
- **AC6b**: Given la sede ofrece un solo tipo de licencia (ej. azul = solo Clase B), When carga el wizard, Then el paso de tipo de licencia se auto-resuelve y se salta; el primer paso visible es "Datos personales".
- **AC6c**: Given la sede ofrece múltiples tipos (ej. roja = Clase B + Profesional) y el usuario llegó sin `courseId`, When carga el wizard, Then el primer paso es la selección de tipo de licencia (Clase B / Profesional), sin mención a otras sedes.
- **AC6d**: Given el usuario llega con `?branchId&courseId` válidos, When carga, Then tanto sede como tipo de licencia quedan resueltos y el primer paso visible es "Datos personales".

### Orientación y progreso

- **AC7**: Given cualquier paso del wizard, When se renderiza la barra de progreso, Then muestra los **nombres** de los pasos (no solo números), resalta el paso actual con el color de la sede, y NO incluye un paso de "Sede".

### Confianza

- **AC8**: Given cualquier paso del wizard, When se renderiza el header, Then incluye el logo/nombre de la escuela + acceso al WhatsApp de contacto de la sede.
- **AC9**: Given el paso de pago (Clase B), When se muestra el CTA "Proceder al pago", Then hay microcopia de confianza adyacente ("Sin cobros sorpresa" y/o "Pago 100% seguro").

### Resumen pre-pago

- **AC10**: Given el flujo Clase B en el paso de pago, When se muestra el resumen, Then lista las **fechas y horas** de las clases prácticas agendadas (no solo el conteo numérico).

### Post-pago

- **AC11**: Given el pago fue confirmado, When el usuario ve `/inscripcion/retorno` en estado success, Then el CTA principal es el WhatsApp de la sede y el secundario es el acceso al portal (`/login`); "Volver al inicio" deja de ser la acción primaria.

### Documentos

- **AC12**: Given el paso de foto carnet, When se renderiza, Then muestra instrucciones inline + ejemplo visual de foto válida/inválida antes (o junto a) el botón de upload.

### Retoma de borrador

- **AC13**: Given existe un borrador guardado, When el usuario vuelve a `/inscripcion`, Then el banner de retoma indica en qué paso quedó y hace cuánto tiempo se guardó.

### Coherencia con la web (cambio mínimo en `webs/`)

- **AC14**: Given el usuario hace clic en un CTA de inscripción en la landing Astro, When navega al wizard, Then se abre en la misma pestaña (`target="_self"`).

### Aislamiento del wizard admin/secretaría (regresión cero)

- **AC15**: Given el rediseño del flujo público está completo, When se abre el wizard de matrícula de admin/secretaría (`SecretariaMatriculaComponent` y `AdminMatriculaComponent`), Then permanece visual y funcionalmente sin cambios (los componentes `matricula-steps/` compartidos no se modifican para el rediseño público).

### Edge cases obligatorios

- **AC-E1**: Given el usuario entra a `/inscripcion` directo **sin `branchId`**, When carga, Then se muestra una pantalla de orientación ("Accede desde el sitio de tu escuela") con enlaces a las webs de cada escuela (azul / roja), SIN exponer un selector de sede dentro del wizard.
- **AC-E2**: Given el usuario restaura un borrador que tenía foto de carnet subida, When entra al paso de documentos, Then el preview de la foto se muestra correctamente (no vacío). *(Corrige el hallazgo #4 del code review del Facade.)*
- **AC-E3**: Given un `branchId` inválido o inexistente en la URL, When carga el wizard, Then se muestra la misma pantalla de orientación de AC-E1 (no rompe la app, no cae a un selector de sede).
- **AC-E4**: Given el flujo Profesional (sin pago), When termina en `pre-confirmation`, Then la pantalla de confirmación es coherente con el rediseño y comunica claramente los próximos pasos.

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec.

- ❌ Cambios en la **lógica** de `PublicEnrollmentFacade` — el state machine y los guards fueron auditados y están correctos. **Excepción permitida:** eliminar el paso `branch` del flujo (incluyendo `buildSteps`, `goBack`, `currentStep` inicial y la lógica de entrada por `branchId`), y corregir AC-E2 (preview de foto en restore). Son cambios estructurales acotados, no de lógica de negocio.
- ❌ Integración / cambios en la pasarela Transbank y la Edge Function `public-enrollment` (salvo lectura).
- ❌ Rediseño del wizard de admin/secretaria (`SecretariaMatriculaComponent` y derivados) — son flujos operativos distintos, con su propio diseño.
- ❌ Exit-intent modal (decisión pendiente; no se implementa en esta spec).
- ❌ Tracking de origen (`utm_source` / `?source=social`) — pendiente, spec futura.
- ❌ Recuperación de abandono por email/WhatsApp automático — requiere infraestructura backend, spec aparte.
- ❌ Sincronización de `priceOverride` web→wizard vía query param — se evalúa en `plan.md`; si requiere backend, sale del scope.

---

## 5. Dependencias

### Specs previas
- `0003` (Landing Pages & Panel de Control) — **done**. Provee las landing Astro y el modelo de marca por sede.
- `0004` (Refactor website_config courses FK) — **done**. Provee `branchCoursePricing` y el catálogo resuelto.

### Capacidades del proyecto que se asumen existentes
- `PublicEnrollmentFacade` con state machine completo y validado (branch/flow/steps/draft/payment).
- `branches` y `courses` con RLS anónima de lectura.
- Edge Function `public-enrollment` operativa.
- `ThemeService`, tokens de color del design system, `GsapAnimationsService`.
- Dumb components de pasos en `shared/components/matricula-steps/`.

### Estrategia de componentes (decidida)

> **Componentes públicos dedicados.** Se reutiliza TODO el vocabulario del design system; los organismos de paso del flujo público se construyen nuevos y exclusivos. El wizard admin/secretaría no se toca (AC15).

- **Se REUTILIZA (sin cambios):** átomos y utilidades del DS — `app-icon`, `skeleton-block`, `app-async-btn`, `app-email-input`, `app-media-upload-control`, utilidades CSS `btn-*`, tokens de color, `GsapAnimationsService`, y los **modelos UI** existentes (`EnrollmentPersonalData`, `EnrollmentAssignmentData`, `EnrollmentDocumentsData`, `EnrollmentContractData`, etc.).
- **Se CREA nuevo (organismos de paso públicos, presentacionales):** un set dedicado para el flujo público (ubicación a definir en `plan.md`, p. ej. `shared/components/public-enrollment-steps/`). Incluye: selección de tipo de licencia, datos personales, modalidad de pago, horario, documentos/foto, contrato, pago y confirmación públicos.
- **Se REUTILIZA del Facade (sin tocar lógica):** `PublicEnrollmentFacade` sigue siendo la fuente de estado y orquestación. Los nuevos componentes son dumb (input/output), igual que los actuales.
- **NO se modifican:** `matricula-steps/personal-data`, `assignment`, `documents`, `contract`, `payment`, `confirmation` (los usa admin/secretaría).

### Capacidades nuevas requeridas
- Mecanismo de **tematización dinámica por `branchId`** dentro del shell del wizard (inyección de color de sede como variable CSS). A definir en `plan.md`.
- **Guard / lógica de entrada** que exige `branchId` válido y deriva a la pantalla de orientación si falta o es inválido.
- **Pantalla de orientación "sin sede"** (nuevo componente o estado) con enlaces a las webs de cada escuela.
- **Set de organismos de paso públicos** nuevos (ver "Estrategia de componentes").
- Extracción de `payment-mode` y `payment` (hoy inline en el componente padre) a componentes públicos dedicados.

---

## 6. Datos y modelo (preliminar)

> Esta spec es primariamente de UI. No introduce tablas nuevas.

- Tablas nuevas / modificadas: **ninguna**.
- Modelos UI nuevos: posible modelo de "contexto de inscripción" (curso + sede + precio) para el banner; posible config de tema por sede.
- RLS requerida: ninguna nueva.

---

## 7. UX y flujos (preliminar)

> North star visual: **el wizard debe verse y sentirse como una continuación de las landing pages Astro** de cada sede.

- **Pantallas afectadas:** todo el shell de `PublicEnrollmentComponent` (header, barra de progreso, card wrapper, fondo) + los Dumb steps cuando aplique + `PublicEnrollmentRetornoComponent` + nueva pantalla de orientación "sin sede".
- **Flujo principal (happy path):**
  - Azul (solo Clase B): web azul (clic CTA, misma pestaña) → wizard tematizado azul → datos personales (con banner de contexto curso/escuela/precio) → modalidad → horario → foto → contrato → pago → retorno con CTA WhatsApp.
  - Roja con CTA genérico: web roja → wizard tematizado rojo → **tipo de licencia (Clase B / Profesional)** → datos personales → … (resto según tipo).
  - Cualquier sede con `courseId`: tipo de licencia ya resuelto → datos personales directo.
- **Estados especiales:**
  - Entrada sin `branchId` (o inválido) → pantalla de orientación con enlaces a las webs (sin selector de sede).
  - Sede con un solo tipo de licencia → paso de tipo se auto-salta.
  - Borrador existente → banner de retoma con paso + tiempo.
  - Pago rechazado/cancelado → pantallas de retorno ya existentes, alineadas al rediseño.

---

## 8. Métricas de éxito post-launch

- Tasa de conversión visitante landing → matrícula pagada (subir).
- Tasa de abandono por paso del wizard (bajar, especialmente en el paso de pago).
- Tasa de retoma de borradores guardados.

---

## 9. Notas / decisiones abiertas

_(ninguna pendiente — todas resueltas)_

### Resueltas

- [x] **Paso de sede eliminado** (2026-06-01): las landings son empresas distintas; la sede es tenant vía `branchId`, no una elección del wizard. Ver AC6/AC6b/AC6c/AC6d.
- [x] **Sin `branchId` → pantalla de orientación** con enlaces a las webs, sin selector interno. Ver AC-E1/AC-E3.
- [x] **Tipo de licencia = primer paso** del wizard, auto-saltado si la sede ofrece una sola opción o si llega `courseId`. Ver AC6b/AC6c/AC6d.
- [x] **Estrategia de componentes** (2026-06-01): componentes públicos dedicados; se reutiliza el DS y los modelos, se crean organismos de paso nuevos, admin no se toca (AC15). Ver sección 5.
- [x] **`payment-mode` y `payment`** se extraen a componentes públicos dedicados (consecuencia de la estrategia de componentes).
- [x] **Tematización por sede** (2026-06-01): se hardcodea el mapping `branchId → 'azul'|'roja'` (igual que la web) e inyecta las variables CSS de sede en el shell del wizard. Sin query extra, determinista. `website_config.brand.theme` queda como fuente de respaldo si en el futuro hay más sedes. Ver `identidad-visual-webs-vs-wizard.md` §6 opción A.
- [x] **Precio = `base_price` de BD** (2026-06-01): el banner y el cobro usan `courses.base_price` (ya es el comportamiento server-side de `initiate-payment`). Display = cobro = `base_price`, internamente consistente. **Residual conocido:** si una sede usa `priceOverride` editorial en la web para una promo, la web mostraría un precio distinto al del wizard; eso requiere honrar el override en backend → fuera de scope, spec futura.
- [x] **Dirección visual aprobada** (2026-06-01): mockup `docs/mockups/inscripcion-rediseno.html` aprobado por el usuario. Lenguaje **premium**: Outfit+Inter, paleta de sede inyectada, hero con gradiente de sede + profundidad (glow/sheen), cards glassmorphism con sombra de marca, banner de contexto con precio en gradiente, progress bar nombrada con ring activo, micro-interacciones (hover lift, card pop, button glow). Es la referencia visual canónica para la implementación.

---

## Changelog

- 2026-06-01 — draft inicial por Akxlarre (redactado desde auditoría + investigación UX).
- 2026-06-01 — revisión: eliminado el paso de selección de sede (empresas distintas → sede = tenant vía `branchId`); tipo de licencia pasa a ser primer paso auto-saltable; pantalla de orientación para entradas sin sede. ACs 3/4/6/7/E1/E3 actualizados.
- 2026-06-01 — revisión: estrategia de componentes públicos dedicados (reusar DS + modelos, crear organismos nuevos, admin intacto); AC15 (regresión cero admin); `payment-mode`/`payment` extraídos a componentes propios.
- 2026-06-01 — todas las decisiones cerradas (tematización, precio, dirección visual aprobada vía mockup premium). Status draft → approved. Track activado.
