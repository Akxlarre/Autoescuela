# Asignación ASG-026 — Fix H-026: la sede activa no persiste tras F5

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Como admin, si se cambia el selector de sede a una específica (ej. "Conductores Chillán") y luego se recarga la página completa (F5), el selector vuelve a "Todas las sedes" sin aviso. La navegación normal dentro de la app (clic en links del sidebar) SÍ preserva la sede correctamente — el problema es específico de una recarga completa del navegador. `BranchFacade.selectedBranchId` vive solo en memoria (signal), no en `localStorage` ni query param.

## Alcance sugerido

- Persistir `selectedBranchId` en `localStorage` (o como query param en la URL, evaluar cuál encaja mejor con el resto de la app) y restaurarlo al iniciar `BranchFacade`.
- Verificar que la restauración respete los permisos del usuario (una secretaria no debería poder "restaurar" una sede que no es la suya, aunque en la práctica su sede está fija por su propio perfil).

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-026.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/branch.facade.ts`

## Notas para quien la reclame

- Impacto bajo pero real: un admin que refresca mientras trabaja en el contexto de una sede específica pierde ese contexto sin darse cuenta y puede terminar operando sobre "Todas las sedes" por error.
