# Asignación ASG-024 — Fix H-031: buscador global (Ctrl+K) no indexa alumnos ni instructores

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

El buscador global (Ctrl+K) funciona bien para nombres de módulos/páginas (ej. "Agenda" → "Agenda de Clases"), pero al escribir el nombre de un alumno real y visible (ej. "Erling" o "Haaland") devuelve "Sin resultados". No indexa datos de negocio (alumnos, instructores, RUTs), aunque el atajo de teclado sugiere que debería poder buscarlos.

## Alcance sugerido

- Extender el índice/lógica del buscador global para incluir alumnos (por nombre y RUT) e instructores (por nombre), no solo navegación estática.
- Definir si la búsqueda de datos de negocio se hace en vivo contra Supabase (con debounce) o si se mantiene un índice local — evaluar impacto de performance con el volumen real de alumnos.
- Al seleccionar un resultado de alumno/instructor, navegar directo a su ficha de detalle.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-031.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/global-search.facade.ts`
- `src/app/core/services/ui/search-panel.service.ts`
- `src/app/shared/components/search-panel/search-panel.component.ts`

## Notas para quien la reclame

- Prioridad media — no bloquea trabajo diario, pero es una herramienta que las secretarias probablemente esperan poder usar dado el atajo de teclado visible.
