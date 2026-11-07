# Fix: Testing — Auditoría y Configuración web en el piloto
> id: fix-485-m-testing-auditoria-configuracion-web
> refs: ASG-i-036
> status: open
> created: 2026-11-07

> **Track de testing, no de corrección.** Acá se registra el resultado de cada caso (✅ / ❌ +
> evidencia). **Cada bug encontrado va a su propio fix/hotfix**; no se corrige dentro de este
> track.
>
> **Checklist:** `specs/testing-piloto/036-auditoria-configuracion-web.md` (casos A–V, sospechas
> S1–S22, decisiones §5). Los resultados se anotan acá, no en el checklist.

## Root Cause

[Heredado de ASG-i-036, a confirmar]: Dos módulos administrativos independientes. **Auditoría**
registra las acciones críticas (quién hizo qué y cuándo). **Configuración web** administra el
contenido de las landing pages de cada sede (cursos, precios, textos). Los dos son bastante
autocontenidos.

**Clasificación:** Funcional · dificultad Baja · rutas: `/app/admin/auditoria`,
`/app/{admin,secretaria}/configuracion-web`, `/politica-privacidad/:branchSlug` (pública).

### Alcance

1. **Funcional** — ACs de specs `0003-b` (landing pages y panel), `0004-b` (cursos con FK al
   catálogo), `ASG-i-020` (atributo disabled en el form), `ASG-b-069` / `ASG-b-072` (app-like).
2. **E2E manual** — acciones críticas en otros módulos aparecen en Auditoría con usuario, fecha,
   sede y detalle correctos; filtros; exportar; Configuración web (6 pestañas, subidas, reflejo en
   la landing `webs/`, aislamiento por sede); política de privacidad por sede.
3. **Seguridad** (solo contra dev) — casos H y R del checklist.

### Sospechas ya atendidas por tracks posteriores al checklist (2026-09-29)

Se verifican como regresión, no como bug nuevo:

| Sospecha | Track que la atendió |
|---|---|
| S1 exportar sin control de rol | `0009-i`, `fix-363-m` |
| S2 autoría falsificable · S3 log insertable | `fix-363-m` (ASG-i-047) |
| S4 tablas sin trigger (parcial) | `fix-206-b` |
| S5 solo se ven secretarias | `fix-069-i` |
| S10 filtro de fechas en UTC | `0024-m` |
| S14 XSS en la landing | `hotfix-008-i` |
| S15 bucket abierto | `fix-178-b` |

### Fuera de alcance

- Publicación de la landing en cPanel (spec `0005-b`, desactivada).
- Catálogo operacional de cursos por dentro (`/app/admin/configuracion-precios`).
- Widget "Actividad reciente" del dashboard (`ASG-i-030`).

## Progreso

- [ ] Revisión en código: estado actual de S1–S22 contra el código vigente
- [ ] Datos de prueba (D1–D11)
- [ ] Auditoría: acceso, tabla, cobertura, atribución, filtros, drawer, exportar (A–G)
- [ ] Auditoría: seguridad e inmutabilidad (H)
- [ ] Configuración web: carga, pestañas, guardar (I–P)
- [ ] Landing pública (Q) y seguridad de configuración web (R)
- [ ] Política de privacidad (V)
- [ ] Visual, app-like y accesibilidad (T)
- [ ] Decisiones de negocio (§5) resueltas o registradas
- [ ] Fixes derivados cerrados y commiteados
- [ ] `/fix-close`

## Resultados

_(se completa durante la ejecución)_

### Decisiones

### Bugs derivados

| Hallazgo | Track | Estado |
|---|---|---|

## ACs Afectados

- `0003-b` y `0004-b` (los que el testing encuentre rotos se listan en "Bugs derivados").

## Cambio

Ninguno dentro de este track (testing). Cada corrección va en su propio fix/hotfix.

## Test de Regresión

Los tests de regresión viven en cada fix derivado.
