# Asignación ASG-i-031 — Testing: Servicios especiales

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-09-29
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

> **Checklist detallado:** `specs/testing-piloto/031-servicios-especiales.md` — casos, datos de prueba, sospechas de bug y pasos. Este archivo es el resumen; el checklist es lo que se ejecuta.

## Contexto / Objetivo

Venta de servicios sueltos (psicotécnico, etc.) a alumnos o clientes externos. Es un módulo
bastante autocontenido; su única conexión fuerte es que la venta tiene que entrar a caja y
reportes.

**Clasificación:** **Funcional** · dificultad **Baja** · rutas: `/app/{admin,secretaria}/servicios-especiales`.

## Alcance sugerido

**1. Funcional (contra ACs ya documentados)**
- ACs de `fix-021-i` (app-like), `fix-022-i` (borrar servicio), `ASG-b-050` (borrar/anular
  ventas).

**2. E2E manual**
- CRUD del catálogo (crear, editar precio, desactivar).
- Registrar una venta a cliente externo y a un alumno → KPIs del módulo + historial.
- Anular/borrar una venta → sale de KPIs **y** de la cuadratura/reportes.
- Exportar el historial de ventas → coincide con la pantalla.
- Sede: la venta queda en la sede correcta.

**3. Candidatos a Playwright (requiere `ASG-i-021`)**
- Venta → assert de KPI "Total recaudado".

## Fuera de alcance

- Ninguno.

## Referencias

- `docs/UAT-PLAN.md` Paquete 4 (caso servicio especial)

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno propio (testing).

## Notas para quien la reclame

- Tanda de testing del piloto (ver `specs/ASSIGNMENTS.md`). Registrar el resultado de cada caso
  (✅ / ❌ + evidencia) en el `fix.md` del track que genere esta asignación. **Cada bug
  encontrado va a su propio fix/hotfix**, no se corrige dentro de este.
