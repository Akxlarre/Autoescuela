# Fix: Simplificar cierre de clase del instructor (sin evaluación embebida) + navegación al dashboard
> id: fix-175-m-instructor-clase-cierre-simplificado
> refs: —
> status: done
> closed: 2026-08-13
> created: 2026-08-13

## Root Cause
`InstructorClaseDetailComponent` (`/app/instructor/clase/:id`, vista "Clase en Curso" /
"Finalizar Sesión") quedó desalineada con la decisión ya tomada de que la evaluación
(checklist de aspectos + nota 3-7) se llena aparte, desde la ficha técnica del alumno
(`InstructorEvaluacionComponent`), no como parte del cierre de la clase. La vista actual:

1. Gatilla un wizard de 2 pasos innecesario: paso 1 (checklist + observaciones) → clic en
   "Finalizar y Registrar Retorno" → paso 2 (km final + nota + firmas). El km, que es lo
   único esencial para cerrar la clase, queda oculto detrás del checklist.
2. Muestra checklist y nota global, que no le corresponden al instructor en este momento
   (evaluación real ocurre después, vía ficha técnica).
3. Las firmas y observaciones capturadas en el formulario **se pierden silenciosamente**
   si el instructor no alcanza a seleccionar una nota: `onFinalize()` solo persiste
   `notes`/firmas cuando `selectedGrade() !== null`, porque ambas viven únicamente dentro
   de `saveEvaluation()`. `finishClass()` (lo único que corre siempre) no las recibe.
4. Falta el modificador `bento-grid--hero-fit` en el `.bento-grid` raíz — sin él, la fila
   del hero slim hereda el piso `--bento-row-min` (120px+) y deja un espacio vacío visible
   antes de la card (mismo patrón ya documentado en `_bento-grid.scss` / fix-081).
5. Al iniciar una clase (`InstructorClaseComponent.onStartClass`), el instructor es
   redirigido directo a esta vista de cierre en vez de volver al dashboard, donde debería
   ver la clase recién iniciada en "Mis Clases de Hoy" con estado "En Curso" — el dashboard
   ya soporta visualmente `in_progress`/`completed` (badge, botón "En Curso" pulsante,
   botón "Ver Ficha"), pero al no volver nunca al dashboard con una clase activa, ese
   camino nunca se ejercitaba en la práctica.

## ACs Afectados
Ninguno — fix autónomo.
- AC-1: La vista de cierre de clase es de un solo paso: Km Final (obligatorio) +
  Observaciones (opcional) + Firmas (opcional). Sin checklist ni nota global.
- AC-2: Firmas y observaciones se persisten siempre que se capturen, sin depender de que
  se haya seleccionado una nota (porque la nota ya no se selecciona acá).
- AC-3: El espacio entre el hero y la card sigue el canon `bento-grid--hero-fit` (sin hueco
  vacío visible).
- AC-4: Al iniciar una clase, el instructor vuelve al dashboard y ve la clase en estado
  "En Curso" en "Mis Clases de Hoy".

## Cambio
- **Archivo:** `src/app/core/models/ui/instructor-portal.model.ts`
  **Qué cambia:** agrega `ClassClosureData` (sessionId, kmEnd, notes?, studentSignature?,
  instructorSignature?) para el nuevo contrato de `finishClass()`.
- **Archivo:** `src/app/core/facades/instructor-clases.facade.ts`
  **Qué cambia:** `finishClass()` acepta `notes`/firmas opcionales, sube las firmas (mismo
  helper `uploadSignature` que ya usa `saveEvaluation`) y las persiste junto al cierre.
- **Archivo:** `src/app/features/instructor/clase-detail/instructor-clase-detail.component.ts`
  **Qué cambia:** colapsa el wizard de 2 pasos en un único formulario (km + observaciones +
  firmas, sin checklist ni nota), agrega `bento-grid--hero-fit`, llama al nuevo
  `finishClass()` extendido.
- **Archivo:** `src/app/features/instructor/clase/instructor-clase.component.ts`
  **Qué cambia:** `onStartClass()` navega a `/app/instructor/dashboard` en vez de a la
  vista de detalle de la clase recién iniciada.

## Test de Regresión
- `src/app/core/facades/instructor-clases.facade.spec.ts > finishClass persiste notes y firmas cuando se proveen` ✓
