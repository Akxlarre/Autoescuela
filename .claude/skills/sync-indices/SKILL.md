---
name: sync-indices
description: >
  Sincronizar los índices del proyecto con el trabajo de la sesión actual.
  Invocar al final de cada sesión de trabajo para mantener la memoria institucional actualizada.
  Actualiza COMPONENTS.md, SERVICES.md, DIRECTIVES.md y DATABASE.md con componentes, servicios,
  directivas y migraciones creados o modificados durante la sesión.
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Edit, Glob, Grep
---

# Sync Indices — Actualización de Memoria Institucional

Tu tarea es revisar el trabajo de esta sesión y mantener los índices del proyecto actualizados.

## Proceso

1. **Lee los cuatro índices actuales**:
   - `indices/COMPONENTS.md`
   - `indices/SERVICES.md`
   - `indices/DIRECTIVES.md`
   - `indices/DATABASE.md`

2. **Busca archivos creados o modificados** en:
   - `src/app/shared/` — nuevos Dumb Components
   - `src/app/features/` — nuevas páginas Smart Components
   - `src/app/core/services/` — nuevos servicios o facades
   - `src/app/core/directives/` — nuevas directivas
   - `src/app/core/models/` — nuevos modelos o interfaces
   - `supabase/migrations/` — nuevas migraciones SQL

3. **Para cada archivo nuevo o modificado**, determina si debe registrarse en un índice

4. **Actualiza las tablas** correspondientes manteniendo el formato Markdown existente

5. **Confirma al usuario** qué entradas fueron agregadas o modificadas

## Reglas

- Solo agrega entradas que correspondan a código real en el repositorio
- Mantén el formato de tabla Markdown existente exactamente
- No elimines entradas existentes sin confirmación explícita del usuario
- Si un componente cambió de estado (ej: 🚧 En desarrollo → ✅ Estable), actualízalo
- Sé conciso en las descripciones — una línea por componente/servicio

## Formato de tablas

### COMPONENTS.md
```markdown
| `nombre-componente` | Molécula | Descripción breve | ✅ Estable |
```

### SERVICES.md
```markdown
| `NombreFacadeService` | Responsabilidad | `core/services/ruta.ts` | Dependencias | ✅ Estable |
```

### DIRECTIVES.md
```markdown
| `NombreDirective` | `[appSelector]` | Propósito en una línea | `input: tipo` | ✅ Estable |
```

### DATABASE.md
```markdown
| `nombre_tabla` | Dominio | `id`, `col_clave` | RLS: SELECT own id | ✅ Estable |
```
