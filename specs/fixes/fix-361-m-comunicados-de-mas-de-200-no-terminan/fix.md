# Fix: un comunicado programado a más de 200 alumnos nunca termina
> id: fix-361-m-comunicados-de-mas-de-200-no-terminan
> refs: ASG-i-057 · 0041-b · 0042-b · 0043-b
> status: open
> created: 2026-10-08

## Root Cause
[Heredado de ASG-i-057, confirmado leyendo el código el 2026-10-08]: el cron
`dispatch-scheduled-announcements` procesa como máximo 8 lotes de 25 (200) por corrida y
**siempre empieza con `offset = 0`**. Los ya enviados se saltan pero igual consumen lote. Si no
termina, queda en `enviando`; el rescate de huérfanos lo vuelve a `programado` a los 30 min y la
corrida siguiente recorre otra vez los mismos 200: del 201 en adelante nunca reciben
(`index.ts:159-181`).

Encontrado al confirmar:
- `email_ok_count`/`email_failed_count` se graban con lo contado en la última corrida, no el total.
- Cada reinicio desde 0 re-materializa el segmento (no duplica por el upsert, pero puede sumar
  destinatarios nuevos a mitad del envío).

Relacionados (🟠, mismo track):
- El envío inmediato lo hace el navegador por lotes y la fila queda `enviado` al crearse: si se
  cierra la pestaña queda a medias (`announcements.facade.ts:299-310,380`).
- Los comunicados llegan a alumnos archivados (`_shared/announcement-send.ts:144-164`).
- Nota de la ASG: el email no debe llevar links al portal (hoy no lleva ninguno — verificar).

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- Paginar desde el primer destinatario pendiente (no desde 0) y no re-materializar si ya existe.
- Conteos finales calculados desde `announcement_recipients`, no desde la corrida.
- Excluir alumnos archivados al materializar.
- Envío inmediato por el mismo despacho del servidor (sin depender de la pestaña abierta).

## Test de Regresión
- Pendiente de definir al implementar.

## Progreso
- [x] Bug confirmado leyendo el código.
- [ ] Paginación por pendientes + conteos totales.
- [ ] Excluir archivados.
- [ ] Envío inmediato en servidor.
- [ ] Test de regresión.
