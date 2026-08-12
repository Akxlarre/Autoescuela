# Fix: Documentos de vehículo no se pueden adjuntar en el flujo de creación (sin patrón staged-docs como instructores)
> id: fix-154-m-vehiculo-crear-staged-docs
> refs: specs/fixes/fix-153-m-vehiculo-documentos-sin-ui-de-carga
> status: done
> closed: 2026-08-11
> created: 2026-08-11

## Root Cause
fix-153-m agregó la posibilidad de cargar documentos (SOAP, Revisión Técnica, Permiso de
Circulación, Seguro) pero solo en el drawer dedicado `VehicleDocumentsDrawerComponent`, accesible
únicamente para un vehículo ya existente (`openDocuments(id)` requiere `id`). El drawer "Nuevo
Vehículo" (`VehicleFormDrawerComponent`) no tiene ninguna indicación de que los documentos se
cargan en otro lugar — el usuario crea el vehículo y no hay ninguna pista de a dónde ir a
completar la documentación obligatoria. Feedback del usuario: no es intuitivo, y el proyecto ya
tiene resuelto este mismo problema (dato que depende de un ID que no existe hasta el submit) en
`admin-instructor-crear-drawer.component.ts` con un patrón "staged docs": el usuario adjunta
archivos localmente durante el formulario, y recién se suben en bucle después de que
`crearInstructor()` devuelve el `instructorId` nuevo.

## ACs Afectados
Ninguno — fix autónomo, ajuste de UX post fix-153-m a partir de feedback directo del usuario.

## Cambio
- **Archivo:** `src/app/core/facades/flota.facade.ts` — `createVehicle()` pasa de `Promise<void>` a
  `Promise<number | null>`, devolviendo el `id` del vehículo recién creado (select tras insert),
  igual que `InstructoresFacade.crearInstructor()`.
- **Archivo:** `src/app/core/utils/vehicle-doc-types.util.ts` (nuevo) — extrae los 4 tipos
  canónicos de documento de vehículo a una única fuente de verdad, reutilizada por
  `VehicleDocumentsDrawerComponent` y el nuevo bloque de `VehicleFormDrawerComponent` (mismo
  patrón que `INSTRUCTOR_DOC_TYPES`).
- **Archivo:** `src/app/features/admin/flota/vehicle-form-drawer/vehicle-form-drawer.component.ts`
  — agrega sección "Documentos (opcional)" visible solo en modo creación (`!isEdit()`): tipo +
  fecha de vencimiento (obligatoria) + archivo (opcional) en una lista `stagedDocs()`. Al enviar,
  primero crea el vehículo y luego sube cada doc en bucle vía `FlotaFacade.upsertVehicleDocument()`
  con el `vehicleId` nuevo — fallas individuales no bloquean el cierre del drawer, se avisan por
  toast (mismo criterio de `admin-instructor-crear-drawer`).

## Test de Regresión
- `flota.facade.spec.ts` — 2 tests nuevos: `createVehicle()` devuelve el `id` insertado y
  propaga el error si el insert falla.
- `vehicle-form-drawer.component.spec.ts` — 4 tests nuevos: `addStagedDoc()` no agrega sin
  tipo/fecha; agrega y saca de `availableDocTypes()`, `removeStagedDoc()` lo devuelve; al crear el
  vehículo sube cada doc staged con el `vehicleId` nuevo; una falla individual de
  `upsertVehicleDocument()` no bloquea el resto ni el cierre del drawer.
- `npx tsc --noEmit`: sin errores. `npm run test:ci`: 1988 tests verdes (0 regresiones).
  `npm run lint:arch`: sin errores nuevos (exit 0).
