# Fix: H-031 — buscador global (Ctrl+K) no indexa alumnos ni instructores
> id: fix-075-b-buscador-global-datos-negocio
> refs: ASG-b-024
> status: in-progress
> created: 2026-07-31

## Root Cause

**[Heredado de ASG-b-024, a confirmar]:** El buscador global (Ctrl+K) funciona bien para nombres
de módulos/páginas (ej. "Agenda" → "Agenda de Clases"), pero al escribir el nombre de un alumno
real y visible (ej. "Erling" o "Haaland") devuelve "Sin resultados". No indexa datos de negocio
(alumnos, instructores, RUTs), aunque el atajo de teclado sugiere que debería poder buscarlos.

Ampliación absorbida de la reunión con el cliente (2026-07-28), parte del mismo track:

1. **Alcance por rol/sede** — al extender el índice a datos de negocio, los resultados deben
   filtrarse por rol y por sede (`resolveBranchScope()` / `getActiveBranchId()`, patrón de
   `.claude/rules/facades.md` § Facades Multi-Sede, ya usado en fix-027). Un instructor solo debe
   encontrar a sus propios alumnos; una secretaria, los de su sede.
2. **Bug de arranque** — el panel de búsqueda tarda en quedar operativo al abrirlo (posible
   problema de autofocus o de inicialización). A reproducir y confirmar antes de asumir causa.

⚠️ Solapa con ASG-b-049 (número de matrícula como dato principal): si el número de matrícula pasa
a ser el identificador operativo del alumno, el buscador debe encontrarlo también por ese número.

## Archivos involucrados (heredado de la Asignación, a verificar)

- `src/app/core/facades/global-search.facade.ts`
- `src/app/core/services/ui/search-panel.service.ts`
- `src/app/shared/components/search-panel/search-panel.component.ts`

## ACs Afectados
Ninguno — fix autónomo, sin AC de spec previa. Referencia: `indices/FLOWS-QA-AUDIT.md`, hallazgo H-031.

## Cambio
_(pendiente — por completar durante la implementación)_

## Test de Regresión
_(pendiente — por completar durante la implementación)_
