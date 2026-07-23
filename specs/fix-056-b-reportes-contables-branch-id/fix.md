# Fix: Reportes Contables no cuenta pagos reales de la sede (descuadre financiero)
> id: fix-056-b-reportes-contables-branch-id
> refs: ASG-009 (specs/assignments/ASG-009-fix-h013-reportes-contables-descuadre.md)
> status: in_progress
> created: 2026-07-23

## Root Cause
[Heredado de ASG-009, a confirmar]: Ninguna secretaria puede cuadrar su caja del mes:
"Pagos" y "Caja Diaria" muestran los ingresos reales de su sede, pero "Reportes Contables"
(mismo rango, misma sede) muestra $0. Confirmado dos veces — con dato histórico y con una
transacción fresca creada durante el audit (matrícula real vía Webpay). Como admin en
"Ambas escuelas" el mismo pago SÍ aparece, pero bajo la categoría "Otros (Sede 0)" — el
registro de ingreso no lleva un `branch_id` resoluble por el filtro de sede de Reportes,
aunque Pagos y Alumnos sí lo resuelven bien.

## ACs Afectados
Ninguno — fix autónomo (bug real detectado en Auditoría QA de Flujos, hallazgo H-013).

## Cambio
<!-- Pendiente de investigación — ver Alcance sugerido de ASG-009 -->
- Localizar el pipeline de creación de pago (flujo público Webpay + flujo presencial) y
  confirmar por qué el `branch_id` no queda resoluble para el query de Reportes
  específicamente, cuando sí lo está para Pagos/Alumnos.
- Candidatos a revisar: `reportes-contables.facade.ts` (cómo resuelve sede al filtrar),
  la Edge Function/trigger que crea el registro de pago (¿escribe `branch_id` directo o
  lo deriva de la matrícula en el momento de leer?).
- Fuera de scope: no cambiar cómo Pagos/Alumnos resuelven sede — esos ya funcionan bien.
- **Archivo:** por confirmar
- **Qué cambia:** por confirmar

## Test de Regresión
<!-- Pendiente -->
