---
name: sync-indices
description: >
  Sincronizar los índices del proyecto con el trabajo de la sesión actual.
  Invocar al final de cada sesión de trabajo para mantener la memoria institucional actualizada.
  Actualiza COMPONENTS.md, SERVICES.md, FACADES.md, MODELS.md, DIRECTIVES.md, GUARDS.md,
  UTILS.md, USAGE-MAP.md y DATABASE.md con artefactos creados o modificados durante la sesión.
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Edit, Glob, Grep, Bash
---

# Sync Indices — Actualización de Memoria Institucional

Tu tarea es revisar el trabajo de esta sesión y mantener los índices del proyecto actualizados.

## Proceso

1. **Ejecuta primero el auto-indexer**:
   ```bash
   npm run indices:sync
   ```
   Esto regenera automáticamente las secciones `AUTO-GENERATED` en **todos** los índices:
   - `indices/COMPONENTS.md` — componentes shared (AST)
   - `indices/SERVICES.md` — servicios utilitarios (AST)
   - `indices/FACADES.md` — facades de dominio (AST)
   - `indices/MODELS.md` — interfaces dto/ y ui/ (AST)
   - `indices/DIRECTIVES.md` — directivas (AST)
   - `indices/GUARDS.md` — guards de ruta (AST)
   - `indices/UTILS.md` — funciones puras de core/utils/ (AST)
   - `indices/USAGE-MAP.md` — mapa de consumo (componentes + directivas + facades + patrones de página)

2. **Lee los índices manuales** que requieren descripción humana:
   - `indices/COMPONENTS.md` — sección manual con descripción rica de cada componente
   - `indices/SERVICES.md` — sección manual con propósito de cada servicio
   - `indices/FACADES.md` — sección manual con dominio y responsabilidad de cada facade
   - `indices/DIRECTIVES.md` — sección manual con propósito y notas de comportamiento
   - `indices/GUARDS.md` — sección manual con rutas protegidas
   - `indices/DATABASE.md` — tablas y esquema Supabase (siempre manual)

3. **Busca archivos creados o modificados** en:
   - `src/app/shared/` — nuevos Dumb Components → COMPONENTS.md (manual)
   - `src/app/core/services/` — servicios/facades → SERVICES.md / FACADES.md (manual)
   - `src/app/core/directives/` — directivas → DIRECTIVES.md (manual)
   - `src/app/core/guards/` — guards → GUARDS.md (manual)
   - `src/app/core/utils/` — utilidades → UTILS.md (auto, solo descripción manual si aplica)
   - `supabase/migrations/` — migraciones SQL → DATABASE.md (siempre manual)

4. **Para cada archivo nuevo**, agrega la entrada manual en la sección correspondiente
   (el AST ya habrá capturado los metadatos técnicos en AUTO-GENERATED)

5. **Confirma al usuario** qué entradas fueron agregadas o modificadas

## Reglas

- El auto-indexer (`npm run indices:sync`) maneja los metadatos técnicos — no dupliques esa info manualmente
- Las secciones manuales agregan **valor semántico**: propósito de negocio, comportamiento notable, notas de uso
- No elimines entradas manuales existentes sin confirmación explícita del usuario
- Si un componente cambió de estado (ej: 🚧 En desarrollo → ✅ Estable), actualízalo
- Sé conciso en las descripciones — una línea por componente/servicio

## Formato de tablas (secciones manuales)

### COMPONENTS.md
```markdown
| `nombre-componente` | Molécula | Descripción breve | ✅ Estable |
```

### SERVICES.md
```markdown
| `NombreService` | Responsabilidad | `core/services/ruta.ts` | ✅ Estable |
```

### DIRECTIVES.md
```markdown
| `NombreDirective` | `[appSelector]` | Propósito en una línea | `input: tipo` | ✅ Estable |
```

### GUARDS.md
```markdown
| `nombreGuard` | `CanActivateFn` | Propósito | Rutas protegidas |
```

### DATABASE.md
```markdown
| `nombre_tabla` | Dominio | `id`, `col_clave` | RLS: SELECT own id | ✅ Estable |
```
