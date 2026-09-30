# Asignación ASG-i-035 — Testing: Tareas/observaciones, notificaciones y comunicados

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-29
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

> **Checklist detallado:** `specs/testing-piloto/035-tareas-notificaciones-comunicados.md` — casos, datos de prueba, sospechas de bug y pasos. Este archivo es el resumen; el checklist es lo que se ejecuta.

## Contexto / Objetivo

Todo lo que comunica al equipo o al alumno: tareas/observaciones internas, notificaciones en
tiempo real (disparadas por triggers SQL y facades) y comunicados masivos a alumnos por email e
in-app con consentimiento (Ley 21.719). Depende de Realtime, que ya falló 2 veces en silencio
porque las tablas no estaban publicadas (`fix-031-i`, `fix-227-m`).

**Clasificación:** **Integración** (Realtime + triggers + email) · dificultad **Media** · rutas:
`/app/admin/{tareas,notificaciones}`, `/app/secretaria/{observaciones,notificaciones}` +
campana del topbar.

## Alcance sugerido

**1. Funcional (contra ACs ya documentados)**
- ACs de specs `0001-b` (tareas multi-rol), `0024-b` … `0027-b` (notificaciones olas 1-4),
  `0013-m` (eliminar notificaciones + historial), `0040-b` (consentimiento de comunicaciones),
  `0041-b` / `0042-b` / `0043-b` (comunicados, plantillas y programación), `fix-030-i` (picker de
  destinatarios por sede).

**2. E2E manual**
- Cada evento de negocio que debe notificar (nueva matrícula, pago, documento por vencer, etc.)
  → llega al rol correcto **sin recargar**; nunca a un usuario de otra sede.
- Eliminar una / todas; drawer de historial.
- Tarea: crear → el destinatario la ve → responde/cambia estado; picker sin destinatarios de otra
  sede.
- Comunicado global: alumnos sin consentimiento quedan excluidos; plantilla; programado para
  más tarde → se envía a la hora; email recibido con el contenido correcto.

**3. Candidatos a Playwright (requiere `ASG-i-021`)**
- 2 contextos: acción en A → notificación en B sin recargar.
- Comunicado excluye a alumnos sin consentimiento (assert sobre la lista de destinatarios).

## Fuera de alcance

- Vista de notificaciones/tareas del instructor y del alumno (fuera del piloto): solo verificar
  que el envío hacia ellos no rompa nada.

## Referencias

- `docs/UAT-PLAN.md` Paquete 6 · `indices/NOTIFICATIONS-MAP.md` · `.claude/rules/notifications.md`

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno propio (testing).

## Notas para quien la reclame

- Tanda de testing del piloto (ver `specs/ASSIGNMENTS.md`). Registrar el resultado de cada caso
  (✅ / ❌ + evidencia) en el `fix.md` del track que genere esta asignación. **Cada bug
  encontrado va a su propio fix/hotfix**, no se corrige dentro de este.
- Usar `indices/NOTIFICATIONS-MAP.md` como checklist de eventos: recorrerlo completo.
