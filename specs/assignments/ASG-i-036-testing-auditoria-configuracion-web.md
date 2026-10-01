# Asignación ASG-i-036 — Testing: Auditoría y Configuración web

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-09-29
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

> **Checklist detallado:** `specs/testing-piloto/036-auditoria-configuracion-web.md` — casos, datos de prueba, sospechas de bug y pasos. Este archivo es el resumen; el checklist es lo que se ejecuta.

## Contexto / Objetivo

Dos módulos administrativos independientes. **Auditoría** registra las acciones críticas (quién
hizo qué y cuándo). **Configuración web** administra el contenido de las landing pages de cada
sede (cursos, precios, textos). Los dos son bastante autocontenidos.

**Clasificación:** **Funcional** · dificultad **Baja** · rutas: `/app/admin/auditoria`,
`/app/{admin,secretaria}/configuracion-web`.

## Alcance sugerido

**1. Funcional (contra ACs ya documentados)**
- ACs de specs `0003-b` (landing pages y panel de control), `0004-b` (cursos con FK al catálogo),
  `ASG-i-020` (atributo disabled en el form de configuración web), `ASG-b-069` / `ASG-b-072`
  (app-like de ambas).

**2. E2E manual**
- Hacer acciones críticas en otros módulos (matricular, pagar, archivar, reprogramar, editar
  usuario) → aparecen en Auditoría con usuario, fecha, sede y detalle correctos.
- Filtros por sede, usuario, acción y fecha.
- Configuración web: editar cursos/precios/textos → se guardan; validaciones; la secretaria solo
  edita su sede; los precios de la landing cuadran con los del catálogo de matrícula.

**3. Candidatos a Playwright (requiere `ASG-i-021`)**
- Acción → registro en auditoría (assert del último registro).

## Fuera de alcance

- Publicación de la landing en cPanel (spec `0005-b`, desactivada).

## Referencias

- `docs/UAT-PLAN.md` Paquete 6 (auditoría)

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno propio (testing).

## Notas para quien la reclame

- Tanda de testing del piloto (ver `specs/ASSIGNMENTS.md`). Registrar el resultado de cada caso
  (✅ / ❌ + evidencia) en el `fix.md` del track que genere esta asignación. **Cada bug
  encontrado va a su propio fix/hotfix**, no se corrige dentro de este.
