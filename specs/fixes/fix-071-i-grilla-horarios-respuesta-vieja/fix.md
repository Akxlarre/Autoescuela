# Fix: La grilla de horarios muestra los de otro instructor si la red está lenta
> id: fix-071-i-grilla-horarios-respuesta-vieja
> refs: fix-058-i-testing-matricula-presencial (B5-2, caso H16)
> status: done
> closed: 2026-11-03
> created: 2026-11-03

## Root Cause

`loadScheduleGrid()` aplica la respuesta de la red sin comprobar que siga siendo la última
pedida. Al cambiar de instructor rápido con la red lenta, una respuesta vieja llega después de
la nueva y pisa la grilla: el selector dice "Instructor3" y los horarios son los de Instructor1.
La secretaria elige un horario de un instructor creyendo que es de otro.

El mismo patrón está en estos facades, y en el refresco de fondo de la matrícula, que sigue vivo
con el `instructorId` anterior mientras carga el nuevo:

- `EnrollmentFacade`: `loadScheduleGrid()` y `handleScheduleChange()` (Realtime).
- `AdminAlumnoDetalleFacade`: `loadScheduleGrid()` (reprogramar y reagendar). Acá además la
  respuesta vieja llena `_slotVehicleMap`, que decide el vehículo de la clase que se guarda.

Una respuesta vieja tampoco debe apagar el indicador de carga de la vigente.

**Fuera de alcance:** `PublicEnrollmentFacade` tiene el mismo patrón, pero la matrícula pública
está bloqueada en el piloto (ver fix-058-i). Ignacio decidió dejarla fuera de este fix.

## ACs Afectados

Ninguno de una spec — caso H16 del checklist `specs/testing-piloto/026-agenda-triple-match.md`.

- **H16:** cambiar de instructor rápido 3 veces con red lenta deja la grilla del último elegido.

## Cambio

- **Archivos:** `core/facades/enrollment.facade.ts`, `admin-alumno-detalle.facade.ts`.
- **Qué cambia:** cada uno usa `createRequestGuard()` en `loadScheduleGrid()`: descarta la
  respuesta que ya no es la última y solo la vigente apaga la carga. En `EnrollmentFacade`, al
  empezar una carga se corta el refresco Realtime del instructor anterior, y el que estaba en
  vuelo se descarta.

## Test de Regresión

- `enrollment.facade.spec.ts > fix-071-i` ✓
- `admin-alumno-detalle.facade.spec.ts > fix-071-i` ✓

## Verificación en navegador (H16, 2026-11-03)

Playwright como secretaria sede 1, alumno de prueba `QA Setenta Drawer` 33.058.071-2 (borrador
descartado al terminar). Las grillas reales de esa semana son iguales entre instructores, así que
la red de prueba marcó como ocupados todos los horarios de los dos primeros instructores y dejó
real el del último.

| Medición | Ocupados | Libres |
|---|---|---|
| Control sin carrera (el marcado se ve en pantalla) | 40 | 0 |
| Al llegar la respuesta del último instructor | 0 | 40 |
| Después de las respuestas viejas (+3,1 s y +5,9 s) | 0 | 40 |

Cubre `EnrollmentFacade`.

## Verificación en navegador (ficha del alumno, 2026-11-03)

Playwright como secretaria sede 1, drawer "Reprogramar clase" de `Alumno130`, sin confirmar ningún
cambio. Mismo método: los dos primeros instructores responden tarde y con todo ocupado, y el último
llega real. Se suman los horarios disponibles de los 4 días de la semana.

| Medición | Disponibles |
|---|---|
| Control: instructor marcado, solo | 0 |
| Control: último instructor, solo | 40 |
| Al llegar la respuesta del último instructor | 40 |
| Después de las respuestas viejas (+3,4 s y +6,6 s) | 40 |

Cubre la grilla de `AdminAlumnoDetalleFacade` desde reprogramar.

## Verificación en navegador (reagendar y vehículo, 2026-11-04)

Playwright como secretaria sede 1, alumno de prueba `Prueba Wizard Matricula Completa` (matrícula
6363, clase 17905). El envío al confirmar se capturó y se cortó en el navegador: nada llegó a la
base. Las respuestas viejas traen `vehicle_id` 99999, un valor que no existe, y el último instructor
llega real (Instructor8, vehículo 30).

Grilla en el drawer de reagendar, con las respuestas viejas marcadas como ocupadas:

| Medición | Libres | Ocupados |
|---|---|---|
| Control: instructor marcado, solo | 0 | 39 |
| Al llegar la respuesta del último instructor | 39 | 0 |
| Después de las respuestas viejas (+16,0 s y +28,1 s) | 39 | 0 |

Vehículo enviado al confirmar:

| Flujo | Control: instructor marcado, solo | Con carrera |
|---|---|---|
| Reagendar (`reschedule_class_b_sessions`) | 99999 | 30 (viejas a +16,1 s y +28,1 s) |
| Reprogramar (`PATCH class_b_sessions`) | 99999 | 30 (una vieja a +5,1 s) |

En reprogramar, la otra respuesta vieja llegó 61 ms antes que la del último instructor, así que solo
una llegó tarde. El guardado real en la base no se ejecutó: se verificó lo que la app envía.
