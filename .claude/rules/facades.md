# Reglas Arquitectónicas para Facades (`core/services/` o `core/facades/`)

Este documento define la ley arquitectónica para la capa de Fachada (Facade) en el proyecto. 
El Facade es el corazón del "Flujo de Datos" y la única forma permitida para que la UI obtenga datos.

## 1. Definición y Propósito
Un Facade es un Servicio de Angular (`@Injectable`) que actúa como el **único punto de entrada** para un "Dominio" o "Feature" de la base de datos (Ej: Alumnos, Instructores, Dashboard).

Su responsabilidad doble y estricta es:
1. **Dialogar con la infraestructura:** Es el único autorizado para llamar a `SupabaseService` (Insertar, Leer, Actualizar, Borrar) o clientes HTTP.
2. **Gestionar el Estado:** Mantiene en memoria el estado reactivo sincrónico usando `Signals`.

## 2. Nomenclatura Estricta
- **Nombre de archivo:** A pesar de que la carpeta se llame `core/services/` (o `core/facades/`), si el archivo maneja datos de dominio y estado de dominio, **debe llevar obligatoriamente el sufijo `.facade.ts`** (Ej: `auth.facade.ts`, `instructores.facade.ts`).
- **Los sufijos `.service.ts`** se reservan exclusivamente para lógica utilitaria transversal sin estado de dominio (Ej: `theme.service.ts`, `gsap-animations.service.ts`).

## 3. Prohibiciones Absolutas en Componentes (UI)
Estas reglas definen el por qué existe el Facade:
- ⛔ **NUNCA** inyectes `SupabaseService` dentro de un componente UI (`*.component.ts`).
- ⛔ **NUNCA** hagas queries directas (`.from('tabla')`) dentro de un componente.
- ⛔ **NUNCA** uses variables de estado sueltas ni RxJS puro (`BehaviorSubject`) en las pantallas; todo estado reactivo se expone y se consume mediante Signals (`signal()`, `computed()`) a través del Facade.

## 4. Estructura Interna Obligatoria de un Facade

Todo Facade debe tener tres secciones claramente divididas:

```typescript
@Injectable({ providedIn: 'root' })
export class EjemploFacade {
  private supabase = inject(SupabaseService);

  // 1. ESTADO REACTIVO (Privado)
  // Nadie fuera del Facade sabe cómo se forma ni lo puede mutar.
  private _datos = signal<DtoModel[]>([]);
  private _isLoading = signal<boolean>(false);
  private _error = signal<string | null>(null);

  // 2. ESTADO EXPUESTO (Público, Solo lectura)
  // Las UI consumen esto para renderizarse automáticamente.
  public readonly datos = this._datos.asReadonly();
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly error = this._error.asReadonly();
  
  // (Opcional) Computed Signals para transformar datos para la UI
  public readonly datosActivos = computed(() => this._datos().filter(d => d.activo));

  // 3. MÉTODOS DE ACCIÓN (Mutadores)
  // Accionan la Base de Datos y actualizan los signals privados.
  async cargarDatos(): Promise<void> {
    this._isLoading.set(true);
    // ... llamada a supabase ...
    this._datos.set(data);
    this._isLoading.set(false);
  }
}
```

## 5. El Flujo de Trabajo (Mente-Máquina)
1. **Pregunta:** "¿Necesito traer datos de la Tabla X para mostrarlos o editarlos?"
2. **Acción 1:** Buscar en `indices/FACADES.md` si ya existe un `X.facade.ts`.
3. **Acción 2 (Si no existe):** Crear `<Dominio>Facade`. (Añadir la query y el signal privado/público).
4. **Acción 3:** Inyectar el `<Dominio>Facade` en el Smart Component.
5. **Acción 4:** Disparar un método del Facade (ej: `cargar()`) desde el `ngOnInit` (o constructor) y dejar que la UI se actualice sola por reactividad (vía `OnPush` y señales). Nunca esperar (await) la respuesta en la UI a menos que sea una acción bloqueante específica (ej. login).

## 6. Transformación de Modelos (DTO → UI Model)

El Facade es el **único lugar** donde se permite transformar un DTO de base de datos en un modelo de UI.

### ¿Cuándo transformar y cuándo no?

**✅ Crea un UI Model y transforma en el Facade cuando:**
- Necesitas **combinar campos** (ej: `first_names` + `paternal_last_name` → `name`)
- Necesitas **campos derivados** que no existen en la BD (ej: `initials`, `badgeColor`, `isExpired`)  
- Los nombres de BD son confusos para la UI (`snake_case` → `camelCase` descriptivo)
- Necesitas solo un subconjunto de campos relevantes para la vista

**✅ Expone el DTO directamente cuando:**
- El DTO ya tiene exactamente los campos que la vista necesita
- Los nombres son claros y directamente utilizables en templates
- Crear un UI Model sería duplicar exactamente la misma estructura sin valor agregado

> **Regla de oro:** No crees modelos de UI por burocracia. El objetivo es claridad, no capas artificiales.

### Ejemplo de transformación (basado en `AuthFacade`):

```typescript
import type { User as UserDto } from '@core/models/dto/user.model';   // ← DTO crudo de BD
import type { User as UserUi } from '@core/models/ui/user.model';     // ← Modelo limpio para la UI

private async loadUserFromSession(authUser: SupabaseAuthUser): Promise<void> {
  // 1. Lee de BD → recibe DTO
  const { data: dbUser } = await this.supabase.client
    .from('users')
    .select('id, first_names, paternal_last_name, ...')
    .eq('supabase_uid', authUser.id)
    .maybeSingle();

  // 2. Transforma DTO → UI Model (aquí ocurre el mapeo)
  const user: UserUi = {
    id: authUser.id,
    name: `${dbUser.first_names} ${dbUser.paternal_last_name}`, // combinación de campos
    initials: getInitialsFromDisplayName(name),                 // campo derivado
    role: dbUser?.roles?.name as UserRole,
    firstLogin: dbUser?.first_login,
  };

  // 3. Expone el UI Model vía Signal (la vista solo conoce esto)
  this._currentUser.set(user);
}
```
