# Reglas del Sistema de Modelos (`core/models/`)

Este documento define la ley arquitectónica para la gestión de interfaces y tipos en el proyecto.

## 1. División Obligatoria (El origen de los datos)

Nunca debe haber modelos sueltos en la raíz de `core/models/`. Todo debe pertenecer a una de dos categorías estrictas:

- 📁 **`domain/`**: Para interfaces que **mapean exactamente** una tabla o vista de tu base de datos Supabase (Ej: `alumno.model.ts`, `clase.model.ts`, `user.model.ts`). Las columnas de la tabla deben estar reflejadas de manera idéntica en la interfaz.
- 📁 **`ui/`**: Para interfaces que definen estructuras de datos puramente **visuales** o de presentación, que no existen como tabla en la BD (Ej: `dashboard.model.ts` para las KpiCards, `table-config.model.ts` para tablas dinámicas, `notification.model.ts` para componentes de alertas/toasts del sistema).

## 2. Nomenclatura Estricta

- **Nombres de Archivos:** Siempre en *kebab-case* y terminados en `.model.ts` (Ej: `payment-method.model.ts`).
- **Nombres de Interfaces:** Siempre en *PascalCase* y en singular, sin prefijos y sin la 'I' característica de C# (Ej: `export interface Instructor { ... }`, **NO** `IInstructor` ni `Instructores`).

## 3. Extensión y Composición (Prohibido Duplicar)

- Si la UI necesita un objeto de Dominio pero con campos adicionales (ej: un `Alumno` que además tiene un `badgeColor` para pintarse en una tabla), **NUNCA clones** la interfaz entera en otro archivo.
- **Regla:** Extiende de la interfaz base de dominio (usando `extends`) o utiliza utilidades de TypeScript como `Omit` o `Pick`.

```typescript
// En core/models/ui/alumno-table.model.ts
import { Alumno } from '../domain/alumno.model';

export interface AlumnoTableRow extends Alumno {
   badgeColor: 'success' | 'warning' | 'error';
   accionesHabilitadas: boolean;
}
```

## 4. El Rol del Facade

- Los **Facades** (`*FacadeService`) son el ÚNICO lugar de la aplicación autorizado a importar un modelo crudo de `domain/`, transformarlo combinándolo con lógica o estado, y entregarlo convertido en un modelo de `ui/` si la vista lo requiere, exponiendo estas transformaciones mediante Signals (`computed()`).
- Los componentes visuales (Smart/Dumb) idealmente solo consumen las interfaces de `ui/` o las básicas de `domain/` sin alterar su estructura.
