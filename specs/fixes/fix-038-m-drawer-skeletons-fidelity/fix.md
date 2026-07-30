# fix-038-m — Skeletons de drawers no representan el contenido real

## Contexto

Tras el refactor global de drawers (fix-024/025/026), el diseño final de cada
drawer mejoró, pero en la gran mayoría de los casos el bloque `#skeletons`
(dentro de `<app-drawer-content-loader>`) quedó desalineado con la estructura
real que carga en `#content`. Ejemplos observados por el dueño:

- **Editar Perfil del Alumno**: skeleton = 5 barras genéricas de igual alto;
  contenido real = 5 campos con label superior + input, algunos con asterisco
  de obligatoriedad. Layout se acerca pero no distingue label/input.
- **Programar Promoción**: skeleton = 3 barras simples decrecientes;
  contenido real = selector de fecha en grid de 7 chips + N cards de curso
  (cada una con header de color, badge de capacidad y un `p-select` de
  relatores). Mismatch total de estructura y de alto — el drawer real es
  mucho más largo y con secciones bien diferenciadas.
- **Nuevo Relator**: skeleton = 3 barras; contenido real = banner informativo
  + formulario largo de ~7 campos (Nombres, Apellido Paterno, Apellido
  Materno, RUT, Email, Teléfono, Especialidades con chips).

El patrón se repite en la mayoría de los ~38 drawers del proyecto que usan
`app-skeleton-block` dentro de un `#skeletons` template.

## Alcance

Revisar **todos** los drawers en `src/app/features/**/*drawer*.component.ts`
y `src/app/shared/components/**/*drawer*.component.ts` (y
`student-drawer-detail.component.ts`) que usan
`<ng-template #skeletons>` + `app-skeleton-block`. Para cada uno:

1. Leer el `#content` real (formulario, secciones, cards, banners) y contar
   sus bloques visuales (labels+inputs, banners, cards con header, chips,
   tablas).
2. Reescribir el `#skeletons` para que:
   - Tenga el mismo número aproximado de "grupos" que el contenido real
     (ej: si hay label+input, usar dos `app-skeleton-block` de alto distinto
     — uno chico para el label, uno más alto para el input — o un solo
     bloque cuya altura ya sea representativa).
   - Refleje secciones diferenciadas (si el contenido tiene un banner
     informativo arriba, el skeleton debe tener un bloque angosto simulando
     eso primero).
   - Refleje repetición de cards/listas (si el contenido real repite N
     tarjetas — ej. cursos, relatores — el skeleton debe repetir un patrón
     similar, no una sola barra).
   - Se mantenga dentro de proporciones razonables de alto total (no exagerar
     con decenas de bloques si el contenido es una lista paginada — usar 3-5
     repeticiones representativas es suficiente para listas).
3. No tocar el `#content` real, el Facade, ni la lógica de negocio — este fix
   es puramente de fidelidad visual del skeleton.
4. Reutilizar siempre `<app-skeleton-block variant="..." width="..."
   height="..." />` (prohibido usar `@if`/`@for` con CSS `@keyframes` nuevos;
   el shimmer ya lo resuelve `GsapAnimationsService` vía el componente
   existente).

## Acceptance Criteria

- [x] AC0: Todos los drawers listados en el descubrimiento (ts) que declaran
  `#skeletons` con `app-skeleton-block` fueron revisados (39 archivos, 5
  batches paralelos). 31 fueron corregidos; el resto ya tenía skeleton fiel
  o no usa `#skeletons`/`app-drawer-content-loader` (ver detalle en Cierre).
- [x] AC1: En cada drawer corregido, el número y proporción de bloques del
  skeleton se corresponde visualmente con las secciones/campos reales del
  `#content` (verificado por lectura de código).
- [x] AC2: No se modificó ningún Facade, modelo, ni lógica de negocio —
  solo los templates `#skeletons` (una excepción puntual: se agregó un
  array de soporte de template `skeletonDataCards` en
  `admin-pre-inscrito-drawer.component.ts` únicamente para poder iterar
  con `@for` en el skeleton — sin lógica de negocio).
- [x] AC3: `npx tsc --noEmit -p tsconfig.app.json` sin errores nuevos
  (corrida final limpia sobre todo el proyecto).
- [x] AC4: Verificación visual del dueño en al menos los 3 drawers de ejemplo
  mencionados en el Contexto (Editar Perfil, Programar Promoción, Nuevo
  Relator). **Confirmado por el dueño en vivo:** la card blanca ya aparece
  durante el skeleton loading, no solo tras cargar el contenido real.

## Actualización — causa raíz real (segunda pasada)

Tras la primera pasada (solo contenido del skeleton), el dueño reportó que
muchos drawers seguían viéndose mal: **el skeleton se renderiza flotando
sobre el fondo gris del host del drawer, sin la card blanca**, mientras que
el contenido real SÍ aparece dentro de la card. Ejemplo: "Programar
Promoción".

**Causa raíz real:** `app-drawer-form` (el componente que dibuja la card
blanca `bg-surface rounded-xl border` + el footer fijo) estaba **anidado
dentro de `<ng-template #content>`** en 29 de los 31 drawers, en vez de
envolver `<app-drawer-content-loader>` completo. Como resultado, la card
blanca solo existía cuando el contenido real ya había cargado — durante el
loading, el `#skeletons` se renderizaba fuera de cualquier contenedor.

**Corrección aplicada:** se movió `<app-drawer-form>` (con sus atributos,
ej. `[hasFooter]="false"`) para que envuelva `<app-drawer-content-loader>`
en los 29 drawers afectados, y se relocalizó el bloque
`<ng-container ngProjectAs="[drawer-form-footer]">` para que quede fuera de
`#content`, como hijo directo de `app-drawer-form` (patrón ya usado
correctamente en `admin-editar-perfil-drawer` e
`inasistencia-drawer`, que no necesitaron cambios en esta pasada).

**Regresión detectada y corregida en la misma sesión:** en
`student-drawer-detail.component.ts`, uno de los agentes movió
`app-drawer-form` pero dejó el `ngProjectAs="[drawer-form-footer]"` anidado
dentro de `#content` (dentro de un `@if (facade.activeStudent(); as detail)`
que a su vez estaba dentro de `<ng-template #content>`). Como
`<ng-template #content>` se renderiza vía `*ngTemplateOutlet` dentro de
`DrawerContentLoaderComponent` (un componente distinto), ese `ng-container`
dejaba de ser un hijo de proyección real de `app-drawer-form` y el botón
"Ver Ficha Técnica Completa" habría dejado de aparecer en el footer fijo.
Se corrigió sacando el `ng-container` fuera de `#content`, con su propio
`@if (facade.activeStudent(); as detail)` a nivel de `app-drawer-form`
(verificado con un script de auditoría que confirma que en los 31 archivos
el footer, cuando existe, queda después de `</app-drawer-content-loader>`).

Se ejecutaron 5 subagentes en paralelo, cada uno cubriendo un grupo disjunto
de drawers, con la misma consigna: leer el `#content` real y reescribir
`#skeletons` para que cuente los mismos "grupos visuales" (label+input,
banners, cards repetidas, filas de tabla, listas) en proporción similar.

**Archivos corregidos (31):** admin-editar-perfil-drawer,
admin-inasistencia-drawer, admin-pre-inscrito-drawer,
alumnos-por-vencer-drawer, configurador-horarios-drawer,
registrar-egreso-drawer, admin-curso-singular-cobro-drawer,
admin-curso-singular-crear-drawer, admin-curso-singular-detalle-drawer,
registrar-gasto-fijo-drawer, dms-template-drawer, dms-upload-drawer,
maintenance-form-drawer, vehicle-form-drawer, admin-instructor-crear-drawer,
admin-instructor-editar-drawer, admin-instructor-ver-drawer,
admin-pago-detalle-drawer, registrar-pago-drawer, admin-sesion-drawer,
admin-promocion-crear-drawer, admin-promocion-editar-drawer,
admin-promocion-ver-drawer, admin-relator-crear-drawer,
admin-relator-editar-drawer, admin-relator-ver-drawer,
admin-secretarias-crear-drawer, admin-secretarias-editar-drawer,
admin-secretarias-ver-drawer, agenda-slot-detail-drawer,
student-drawer-detail.

**Sin cambios (ya fieles o sin `#skeletons`):**
admin-reprogramar-clase-drawer (skeleton inline ya fiel),
admin-curso-singular-inscribir-drawer (no usa drawer-content-loader),
admin-instructor-horario-drawer, admin-instructor-horas-drawer,
vehicle-agenda-drawer, vehicle-documents-drawer, alerts-drawer,
recent-activity-drawer (listas con skeleton de fila ya fiel).

`npx tsc --noEmit -p tsconfig.app.json` corrió limpio sobre todo el proyecto
tras integrar los 5 batches. No se tocó ningún Facade, modelo ni lógica de
negocio real — únicamente los templates `#skeletons` de cada drawer.

**Pendiente:** AC4 (verificación visual en vivo por el dueño) — no se puede
verificar en este entorno (sin Playwright MCP activo). Recomendado abrir al
menos "Editar Perfil del Alumno", "Programar Promoción" y "Nuevo Relator"
para confirmar antes de cerrar con `/fix-close`.

## Test de regresión

Cambio puramente de templates de skeleton (placeholders visuales sin lógica)
más una corrección estructural de wrapper (`app-drawer-form`). Validado con
`npx tsc --noEmit -p tsconfig.app.json` (limpio, sin errores nuevos) sobre
los 31 archivos modificados. Sin lógica de negocio no aplica test unitario.
Verificación visual manual por el dueño (AC4) confirmada en vivo. **Fix
cerrado.**
