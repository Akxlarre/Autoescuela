# Asignación ASG-i-057 — Un comunicado programado a más de 200 alumnos nunca termina

> **status:** reclamada
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** m
> **claimed_at:** 2026-10-08
> **resulting_track:** fix-361-m-comunicados-de-mas-de-200-no-terminan

---

## Contexto / Objetivo

**Sospecha no confirmada en vivo** (tanda de testing 2026-09-29). El cron de comunicados
programados procesa como máximo 8 lotes de 25 (200) por corrida y **siempre empieza desde el
destinatario 0**. Los ya enviados se saltan pero igual consumen lote, así que la corrida
siguiente vuelve a recorrer los mismos 200: los alumnos 201 en adelante nunca reciben el
comunicado (`dispatch-scheduled-announcements/index.ts:52,159-181`).

Relacionados (🟠): el envío inmediato lo hace el navegador por lotes y la fila queda `enviado`
al crearse (si se cierra la pestaña, queda a medias: `announcements.facade.ts:299-310,380`); los
comunicados llegan a alumnos archivados (`_shared/announcement-send.ts:144-164`).

## Alcance sugerido

- **Paso 1, confirmar** leyendo el código (la prueba real necesita >200 destinatarios de prueba).
- Paginar desde el primer destinatario pendiente (cursor o filtro por "no enviado").
- Evaluar mover el envío inmediato también al servidor, y excluir alumnos archivados.

## Referencias

- `specs/testing-piloto/035-tareas-notificaciones-comunicados.md` S1, S3, S4
- Specs `0041-b`, `0042-b`, `0043-b`

## Archivos involucrados (opcional, para detectar solapes)

- `supabase/functions/dispatch-scheduled-announcements/index.ts`, `supabase/functions/_shared/announcement-send.ts`
- `src/app/core/facades/announcements.facade.ts`

## Notas para quien la reclame

- En el piloto el alumno no puede entrar a su portal (bloqueado); revisar también que el email del
  comunicado no lleve links al portal.
