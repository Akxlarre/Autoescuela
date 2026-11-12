# Fix: el aviso de documentos del vehículo en la Agenda solo vive en un tooltip
> id: fix-251-b-agenda-aviso-documentos-vehiculo-visible
> refs: fix-247-b (misma regla: avisar en ámbar, no bloquear), I12 de la Agenda
> status: done
> closed: 2026-11-11
> created: 2026-11-11

## Root Cause
El aviso "Vehículo RTRE29: SOAP vencido" se calcula bien (`buildVehicleDocWarningMap`) pero la
Agenda solo lo muestra en el `pTooltip` de un triángulo de 12px en `AgendaSlotComponent`:
- El drawer de detalle (`AgendaSlotDetailDrawerComponent`) nunca lee `vehicleDocWarning`: al abrir
  el horario se ve "Disponible" + la patente, sin rastro del problema.
- El aviso no entra en el `aria-label` del slot y no existe sin hover (tablet, teclado).
- En la vista "Todos los instructores", los slots libres de una celda expandida solo dicen
  `+ 15:00`: no hay forma de saber cuál es el vehículo con el triángulo.
- El aviso es del vehículo, no del horario: no hay un resumen que lo diga una vez por semana.
- En clases completadas o "no asistió" se muestra igual, aunque el estado se calcula contra hoy
  y no sirve para una clase que ya pasó.

## ACs Afectados
Ninguno de una spec — extensión de la regla de fix-247-b a la Agenda:
- **A1:** el drawer de detalle muestra el aviso en un `app-alert-card` ámbar con la patente y los
  documentos, en horarios disponibles, agendados y en curso, con un acceso a Flota del portal actual.
- **A2:** en clases completadas, "no asistió" o canceladas no hay aviso (ni en el drawer ni en la grilla).
- **A3:** el `aria-label` del slot incluye el aviso.
- **A4:** en la celda expandida de la vista "Todos", cada slot libre muestra instructor y patente.
- **A5:** sobre la grilla, una sola línea resume los vehículos con documentos vencidos o por vencer
  de los días visibles, igual que el aviso de licencias vencidas (fix-202-b).
- **A6:** nada se bloquea; sin documentos observados no aparece ningún aviso.
- **A7:** la celda expandida de la vista "Todos" agranda su fila (hasta 240px, con scroll interno)
  en vez de montarse sobre las filas de abajo. Causa: con la grilla de alto fijo (flex-1),
  `grid-auto-rows: minmax(56px, auto)` dejaba cada fila en 56px; pasa a `max-content` y el piso de
  56px lo ponen el `min-height` de las celdas y de la cabecera de día.

## Cambio
- **Archivo:** `src/app/core/utils/vehicle-document-status.utils.ts` — `vehicleDocWarningApplies(status)`
  y `vehicleDocWarningsNotice(slots)`.
- **Archivo:** `src/app/core/utils/agenda-week.utils.ts` — `fleetUrl(currentUrl)`.
- **Archivo:** `src/app/features/agenda/agenda-slot-detail-drawer.component.ts` — aviso + "Ver en Flota".
- **Archivo:** `src/app/shared/components/agenda-semanal/agenda-slot.component.ts` — aria, identidad
  en libres (input `showIdentity`), sin aviso en clases pasadas.
- **Archivo:** `src/app/shared/components/agenda-semanal/agenda-semanal.component.ts` — línea resumen.

## Test de Regresión
- `src/app/core/utils/vehicle-document-status.utils.spec.ts` > `vehicleDocWarningApplies`, `vehicleDocWarningsNotice` ✓
- `src/app/core/utils/agenda-week.utils.spec.ts` > `fleetUrl`, `agendaSlotAriaLabel`, `agendaSlotIdentity` ✓
  — la lógica del slot vive en utils puros: `agenda-slot.component.spec.ts` sigue excluido de
  Vitest (sin el plugin de Angular, `setInput` no reconoce inputs de signal: NG0303).
- `src/app/features/agenda/agenda-slot-detail-drawer.component.spec.ts` (5 tests) ✓
- `e2e/agenda-aviso-documentos-vehiculo.spec.ts` (2 tests, solo lectura: intercepta
  `vehicle_documents`) ✓ — resumen, aria, aviso en el detalle, "Ver en Flota", identidad en
  "Todos" y la celda expandida sin montarse sobre las filas de abajo. Revisado en capturas.
- `npm run test:ci`: 5079 en verde; 2 fallas en `instructor-clases` y `promociones` que pasan
  aisladas (timeouts bajo carga, archivos no tocados). `lint:arch`: 0 errores.
- `e2e/agenda.spec.ts`: A10 (app-like), B17 (ARIA) y P02/P04 en verde; los que fallan buscan
  instructores "Instructor1 Apellido1" que ya no existen en la BD (deriva de datos, no de este fix).
