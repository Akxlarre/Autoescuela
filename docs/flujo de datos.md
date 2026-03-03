Esta guía define el flujo obligatorio para la gestión del estado y la obtención de datos en nuestra aplicación, y está pensada para estandarizar cómo el equipo interactúa con la base de datos y la UI.

## 1. El Flujo de Datos (La Única Regla)

Al tener Supabase como backend, nuestro cliente de base de datos es lo suficientemente potente como para reducir la fricción tradicional.

El flujo canónico de nuestra aplicación es:

```
Base de Datos (Supabase) → DTO → Facade (mapeo + estado) → UI (Smart Components)
```

**Prohibiciones Absolutas:**
- ⛔ NUNCA inyectes `SupabaseService` dentro de un componente UI.
- ⛔ NUNCA hagas queries directas (`.from('tabla')`) dentro de un `*.component.ts`.
- ⛔ NUNCA uses `HttpClient` para llamadas a nuestra propia base de datos.
- ⛔ NUNCA uses variables de estado sueltas ni rxjs puro (`BehaviorSubject`) en las pantallas; todo estado reactivo se expone y se consume mediante Signals (`signal()`, `computed()`).

## 2. ¿Qué es un Facade en nuestro proyecto?

Un Facade (Fachada) es un Servicio de Angular (`@Injectable`) que actúa como el único punto de entrada para un "Dominio" o "Feature" completo de la base de datos (Ej: Alumnos, Clases, Inventario).

Su responsabilidad doble es:
1. Dialogar con Supabase (Insertar, Leer, Actualizar, Borrar).
2. Mantener en memoria un Signal (estado reactivo sincrónico) con los resultados, permitiendo que múltiples pantallas lo consuman en tiempo real sin llamar a la base de datos N veces.

> **Nota**: A pesar de que la carpeta se llame `core/services/`, si el archivo maneja datos de dominio y estado de dominio, debe llevar el sufijo `.facade.ts` (Ej: `auth.facade.ts`, `clases.facade.ts`). Los archivos con sufijo `.service.ts` se reservan para lógica utilitaria transversal (Ej: `ThemeService`, `LayoutService`).

## 3. Ejemplo Práctico: Implementando un Dominio

Supongamos que el equipo debe desarrollar el módulo de "Instructores".

### Paso 1: El DTO (`core/models/dto/instructor.model.ts`)

Aquí van las interfaces que mapean exactamente la estructura de las tablas de Supabase. Son estructuras puras de datos, **sin comportamiento**.

```typescript
// core/models/dto/instructor.model.ts
export interface Instructor {
  id: number;
  rut: string;
  first_names: string;
  paternal_last_name: string;
  estado: 'activo' | 'inactivo';
}
```

### Paso 2 (Opcional): Modelo de UI (`core/models/ui/instructor-card.model.ts`)

Solo créalo si la vista necesita campos que no existen en el DTO o necesita transformación.
En este caso, queremos mostrar el nombre completo y un color de badge:

```typescript
// core/models/ui/instructor-card.model.ts
import { Instructor } from '../dto/instructor.model';

export interface InstructorCard extends Pick<Instructor, 'id' | 'rut'> {
  nombreCompleto: string;          // ← campo combinado (no existe en BD)
  badgeColor: 'success' | 'error'; // ← campo derivado del estado
}
```

> **Si la vista no necesita transformación**, el Facade puede exponer el DTO directamente. No crees modelos de UI por burocracia.

### Paso 3: El Facade (`core/facades/instructores.facade.ts`)

El Facade es el **mapeador**: lee DTOs de Supabase y los transforma al modelo de UI si es necesario.

```typescript
import { Injectable, signal, inject, computed } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type { Instructor } from '@core/models/dto/instructor.model';
import type { InstructorCard } from '@core/models/ui/instructor-card.model';

@Injectable({ providedIn: 'root' })
export class InstructoresFacade {
  private supabase = inject(SupabaseService);

  // Estado privado (DTO crudo de BD)
  private _instructores = signal<Instructor[]>([]);
  private _isLoading = signal<boolean>(false);
  private _error = signal<string | null>(null);

  // Estado público (solo lectura para la UI)
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly error = this._error.asReadonly();

  // Computed: transforma DTO → UI Model (se recalcula automáticamente)
  public readonly instructoresActivos = computed<InstructorCard[]>(() =>
    this._instructores()
      .filter(i => i.estado === 'activo')
      .map(i => ({
        id: i.id,
        rut: i.rut,
        nombreCompleto: `${i.first_names} ${i.paternal_last_name}`,
        badgeColor: i.estado === 'activo' ? 'success' : 'error',
      }))
  );

  async cargarInstructores(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    const { data, error } = await this.supabase.client
      .from('instructores')
      .select('*')
      .order('paternal_last_name');

    if (error) {
      this._error.set(error.message);
    } else if (data) {
      this._instructores.set(data as Instructor[]);
    }

    this._isLoading.set(false);
  }
}
```

### Paso 4: El Componente (Smart Component)

Los Smart Components en `features/` inyectan el Facade y exponen sus Signals al template.

```typescript
// features/admin/instructores/instructores-list.component.ts
import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { InstructoresFacade } from '@core/facades/instructores.facade';
// ✅ El componente solo conoce el modelo de UI, nunca el DTO de BD

@Component({
  selector: 'app-instructores-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isLoading()) {
      <app-instructor-skeleton />
    }

    @if (error()) {
      <div class="alert alert-error">{{ error() }}</div>
    }

    @for (instructor of instructoresActivos(); track instructor.id) {
      <app-instructor-card [info]="instructor" />
    }
  `
})
export class InstructoresListComponent implements OnInit {
  private facade = inject(InstructoresFacade);

  // Expone los Signals del Facade al template
  protected instructoresActivos = this.facade.instructoresActivos;
  protected isLoading = this.facade.isLoading;
  protected error = this.facade.error;

  ngOnInit() {
    this.facade.cargarInstructores();
  }
}
```

## 4. Resumen de Flujo para el Equipo

**Pregunta:** "¿Necesito traer datos de la Tabla X para mostrarlos o editarlos?"

1. Buscar en `indices/FACADES.md` si ya existe un `X.facade.ts`.
2. Si no existe: crear `<Dominio>Facade` con el DTO, el query y los signals.
3. Inyectar el Facade en el Smart Component.
4. Disparar el método del Facade desde `ngOnInit` y dejar que la UI reaccione sola.