# Asignación ASG-i-037 — Testing transversal: multi-sede (RLS), responsive, modo oscuro y app-like

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-09-29
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

> **Checklist detallado:** `specs/testing-piloto/037-transversal-multisede-shell.md` — casos, datos de prueba, sospechas de bug y pasos. Este archivo es el resumen; el checklist es lo que se ejecuta.

## Contexto / Objetivo

Hay aspectos que no son de ningún módulo en particular, sino de todos. El más grave es el
**aislamiento por sede**: una secretaria nunca debe ver ni tocar datos de otra sede. Eso lo
aseguran el RLS y el filtro de los facades, y ya falló varias veces por facades que asumían un
scope sin verificarlo (DG-084/085/086). Además hay que revisar layout responsive, modo
claro/oscuro, contrato app-like y consola/red limpias en **todas** las pantallas del piloto; el
UAT de agosto lo probó en 1 a 5 pantallas "por tiempo".

**Clasificación:** **E2E transversal** · dificultad **Alta** · rutas: todas las del piloto (ver
`indices/ROUTES.md` sin `pilotPhaseGuard`).

## Alcance sugerido

**1. Funcional (contra ACs ya documentados)**
- ACs de specs `0005-m` (facades sin respuestas stale), `0017-b` (multi-sede), `0028-b` (layout
  dual) y el registro de `indices/APP-LIKE-ROLLOUT.md`.

**2. E2E manual**
- **Multi-sede, en cada módulo:** secretaria sede A no ve datos de la B (listados, búsquedas,
  pickers, dashboard, exportaciones, notificaciones). Admin "Todas las sedes" = suma de las
  sedes. Cambio de sede rápido → nunca quedan datos mezclados.
- **Acceso directo por API:** con la sesión de una secretaria, intentar leer/escribir filas de
  otra sede vía Supabase (consola del navegador) → el RLS lo rechaza.
- Cada pantalla del piloto a 375, 768 y 1440 px: sin scroll horizontal; en desktop, app-like
  (el documento no scrollea, los paneles sí).
- Cada pantalla en claro y oscuro: contraste legible (el wizard/datepicker ya falló en oscuro,
  `fix-152-b`).
- Consola sin errores y red sin 4xx/5xx inesperados en cada pantalla.

**3. Candidatos a Playwright (requiere `ASG-i-021`)**
- Barrido automático de todas las rutas del piloto × {admin, secretaria} × {375, 1440} × {claro,
  oscuro}: carga sin errores de consola, sin 4xx/5xx y sin scroll horizontal. Es el test con
  mejor relación costo/cobertura de toda la tanda.
- Test de RLS: cliente Supabase con la sesión de la secretaria A → `select` de filas de la sede B
  devuelve 0.

## Fuera de alcance

- Funcionalidad propia de cada módulo (cubierta por `ASG-i-022` … `ASG-i-036`).

## Referencias

- `.claude/rules/facades.md` §7 (branch-scoped) · `indices/DOMAIN-GOTCHAS.md` (DG-084…086)
- `indices/APP-LIKE-ROLLOUT.md` · `.claude/skills/verify/SKILL.md` · `docs/UAT-PLAN.md` Paquete 7

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno propio (testing).

## Notas para quien la reclame

- Tanda de testing del piloto (ver `specs/ASSIGNMENTS.md`). Registrar el resultado de cada caso
  (✅ / ❌ + evidencia) en el `fix.md` del track que genere esta asignación. **Cada bug
  encontrado va a su propio fix/hotfix**, no se corrige dentro de este.
- Una fuga de datos entre sedes es **bloqueante** para la entrega: reportarla como P0 de inmediato.
