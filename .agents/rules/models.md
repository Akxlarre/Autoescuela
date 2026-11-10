# Reglas del Sistema de Modelos (`core/models/`)

Este documento define la ley arquitectónica para la gestión de interfaces y tipos en el proyecto.

## 1. División Obligatoria (El origen de los datos)

Nunca debe haber modelos sueltos en la raíz de `core/models/`. Todo debe pertenecer a una de dos categorías estrictas:

- 📁 **`dto/`** *(Data Transfer Objects)*: Para interfaces que **mapean exactamente** una tabla o vista de tu base de datos Supabase (Ej: `alumno.model.ts`, `clase.model.ts`, `user.model.ts`). Las columnas de la tabla deben estar reflejadas de manera idéntica en la interfaz. **Son estructuras de datos puros, sin comportamiento.**
- 📁 **`ui/`**: Para interfaces que definen estructuras de datos puramente **visuales** o de presentación, que no existen como tabla en la BD (Ej: `dashboard.model.ts` para las KpiCards, `table-config.model.ts` para tablas dinámicas, `notification.model.ts` para componentes de alertas/toasts del sistema).

## 2. Nomenclatura Estricta

- **Nombres de Archivos:** Siempre en *kebab-case* y terminados en `.model.ts` (Ej: `payment-method.model.ts`).
- **Nombres de Interfaces:** Siempre en *PascalCase* y en singular, sin prefijos y sin la 'I' característica de C# (Ej: `export interface Instructor { ... }`, **NO** `IInstructor` ni `Instructores`).

## 3. Extensión y Composición (Prohibido Duplicar)

- Si la UI necesita un objeto DTO pero con campos adicionales (ej: un `Alumno` que además tiene un `badgeColor` para pintarse en una tabla), **NUNCA clones** la interfaz entera en otro archivo.
- **Regla:** Extiende de la interfaz base DTO (usando `extends`) o utiliza utilidades de TypeScript como `Omit` o `Pick`.

```typescript
// En core/models/ui/alumno-table.model.ts
import { Alumno } from '../dto/alumno.model';

export interface AlumnoTableRow extends Alumno {
   badgeColor: 'success' | 'warning' | 'error';
   accionesHabilitadas: boolean;
}
```

## 4. El Rol del Facade: Mapeador Obligatorio

El Facade es el **único lugar** autorizado a importar un DTO crudo, transformarlo y entregarlo como modelo de `ui/` si la vista lo requiere.

### Tabla de referencia rápida

| Capa | Importa de `dto/` | Importa de `ui/` |
|---|---|---|
| `services/infrastructure/` | ✅ Sí | ❌ No |
| `*.facade.ts` | ✅ Sí (para leer de BD) | ✅ Sí (para exponer al estado) |
| `*.component.ts` (Smart) | ❌ **Nunca** | ✅ Sí |
| `*.component.ts` (Dumb) | ❌ **Nunca** | ✅ Sí |

### Ejemplo concreto de mapeo (basado en `AuthFacade` real del proyecto)

```typescript
// ✅ CORRECTO: El Facade importa el DTO (datos crudos de BD) y lo transforma a UI
import type { User as UserDto } from '@core/models/dto/user.model';   // campos snake_case de Supabase
import type { User as UserUi } from '@core/models/ui/user.model';     // campos camelCase para la vista

private async loadUserFromSession(authUser: SupabaseUser): Promise<void> {
  // 1. Lee de BD → recibe el DTO crudo
  const { data: dbUser } = await this.supabase.client
    .from('users')
    .select('id, first_names, paternal_last_name, branch_id, ...')
    .eq('supabase_uid', authUser.id)
    .maybeSingle();

  // 2. Mapeo DTO → UI Model (esta es la responsabilidad del Facade)
  const user: UserUi = {
    id: authUser.id,                                           // UUID de Supabase Auth
    dbId: dbUser?.id,                                          // PK numérica de la tabla
    name: `${dbUser.first_names} ${dbUser.paternal_last_name}`, // combinación de campos
    role: dbUser?.roles?.name as UserRole,
    initials: getInitialsFromDisplayName(name),                // campo derivado
    firstLogin: dbUser?.first_login,
  };

  // 3. Expone el UI Model a través de un Signal (la UI solo ve esto)
  this._currentUser.set(user);
}
```

### ¿Cuándo NO hace falta crear un modelo de UI?

**No siempre es necesario un modelo de UI.** Si el DTO ya sirve directamente para lo que la vista necesita (mismos campos, mismos nombres), el Facade puede exponerlo tal cual. **No crees modelos de UI por burocracia.**

Crea un modelo de UI cuando al menos una de estas condiciones aplique:
- La vista necesita **campos combinados** (ej: `nombre completo` desde `first_names` + `paternal_last_name`)
- La vista necesita **campos derivados** que no existen en la BD (ej: `initials`, `badgeColor`, `isExpired`)
- Los **nombres de los campos de BD son confusos** para la UI (ej: `snk_case` → `camelCase`)
- La vista necesita un **subconjunto** de campos (usa `Pick<Dto, 'id' | 'name'>` en ese caso)
