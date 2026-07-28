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

## Ampliación — reunión con el cliente 2026-07-28

Dos anotaciones del cliente caen exactamente sobre esta asignación y se absorben acá en vez de
crear una ASG nueva:

1. **Alcance por rol** — *"Arreglar buscador para que esté configurado dependiendo de quien lo
   esté usando, por ejemplo un instructor podría buscar cosas que no le corresponden."*
   Al extender el índice a datos de negocio, los resultados **deben filtrarse por rol y por
   sede**, no solo por texto. Un instructor solo debe encontrar a sus propios alumnos; una
   secretaria, los de su sede. Esto es parte del mismo trabajo: si se indexa sin scope, se abre
   una fuga de datos entre sedes/roles que hoy no existe.
2. **Bug nuevo** — *"Revisar bug del buscador que no inicia al tiro."* El panel de búsqueda
   tarda en quedar operativo al abrirlo (posible problema de autofocus o de inicialización).
   Reproducir y corregir dentro de este mismo track.

Referencia de scope: `.claude/rules/facades.md` § Facades Multi-Sede y el patrón
`resolveBranchScope()` / `getActiveBranchId()` usado en fix-027.

## Notas para quien la reclame

- Prioridad media — no bloquea trabajo diario, pero es una herramienta que las secretarias probablemente esperan poder usar dado el atajo de teclado visible.
- ⚠️ **Se solapa con ASG-049** (número de matrícula como dato principal). Si el número de
  matrícula pasa a ser el identificador operativo del alumno, el buscador tiene que encontrarlo
  por ese número además de por nombre y RUT.
