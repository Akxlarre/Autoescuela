Esta guía define el flujo obligatorio para la gestión del estado y la obtención de datos en nuestra aplicación, y está pensada para estandarizar cómo el equipo interactúa con la base de datos y la UI.

1. El Flujo de Datos (La Única Regla)
Hemos abandonado la arquitectura tradicional N-Tier engorrosa . Al tener Supabase como backend, nuestro cliente de base de datos es lo suficientemente potente como para reducir la fricción.

El flujo canónico de nuestra aplicación es el siguiente: Base de Datos (Supabase) ➡️ Interfaces/Types ➡️ Facade (Estado Global) ➡️ UI (Smart Components)

Prohibiciones Absolutas (Para el Equipo):
⛔ NUNCA inyectes SupabaseService dentro de un componente UI.
⛔ NUNCA hagas queries directas (.from('tabla')) dentro de un *.component.ts.
⛔ NUNCA uses HttpClient para llamadas a nuestra propia base de datos HTTP.
⛔ NUNCA uses variables de estado sueltas ni rxjs puro (BehaviorSubject) en las pantallas; todo estado reactivo se expone y se consume mediante Signals (signal(), computed()).
2. ¿Qué es un Facade en nuestro proyecto?
Un Facade (Fachada) es un Servicio de Angular (@Injectable) que actúa como el único punto de entrada para un "Dominio" o "Feature" completo de la base de datos (Ej: Alumnos, Clases, Inventario).

Su responsabilidad doble es:

Dialogar con Supabase (Insertar, Leer, Actualizar, Borrar).
Mantener en memoria un Signal (estado reactivo sincrónico) con los resultados de aquello que se consultó, permitiendo que múltiples pantallas (Smart Components) lo consuman en tiempo real sin llamar a la base de datos N veces.
NOTA: A pesar de que la carpeta se llame core/services/, si el archivo maneja datos de dominio y estado de dominio, debe llevar el sufijo 
.facade.ts
 (Ej: 
auth.facade.ts
, clases.facade.ts). Los archivos con sufijo .service.ts se reservan para lógica utilitaria transversal (Ej: ThemeService, LayoutService).

3. Ejemplo Práctico: Implementando un Dominio
Supongamos que el equipo debe desarrollar el módulo de "Instructores".

Paso 1: El Modelo (core/models/instructor.model.ts)
Aquí van las interfaces exactas que mapearán la estructura de las tablas de Supabase.

typescript
export interface Instructor {
  id: string;
  nombre_completo: string;
  rut: string;
  estado: 'activo' | 'inactivo';
}
Paso 2: El Facade (core/services/instructores.facade.ts)
Aquí condensamos la consulta a Supabase y el estado en Signals.

typescript
import { Injectable, signal, inject, computed } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Instructor } from '@core/models/instructor.model';
@Injectable({ providedIn: 'root' })
export class InstructoresFacade {
  private supabase = inject(SupabaseService);
  // 1. Estado reactivo (Privado, nadie fuera sabe cómo se forma)
  private _instructores = signal<Instructor[]>([]);
  private _isLoading = signal<boolean>(false);
  private _error = signal<string | null>(null);
  // 2. Estado expuesto (Solo lectura para que la UI los consuma)
  public readonly instructores = this._instructores.asReadonly();
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly error = this._error.asReadonly();
  // (Opcional) Computed Signals para derivar datos sin manipular el arreglo original
  public readonly instructoresActivos = computed(() => 
    this._instructores().filter(i => i.estado === 'activo')
  );
  // 3. Métodos que accionan a la Base de Datos
  async cargarInstructores(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);
    // Consulta directa a Supabase (El "Servicio" embebido)
    const { data, error } = await this.supabase.client
      .from('instructores')
      .select('*')
      .order('nombre_completo');
    if (error) {
      this._error.set(error.message);
    } else if (data) {
      // Modifica el estado global (Las UI reaccionarán en OnPush automáticamente)
      this._instructores.set(data as Instructor[]);
    }
    
    this._isLoading.set(false);
  }
}
Paso 3: El Componente (Smart Component UI)
Los componentes que crees en features/ van a ser extremadamente limpios. Solo inyectan el Facade y atan el HTML a los Signals.

typescript
// features/admin/instructores/instructores-list.component.ts
import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { InstructoresFacade } from '@core/services/instructores.facade';
@Component({
  selector: 'app-instructores-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Uso del Control Flow nativo (@if) sobre los Signals (ejecución con paréntesis) -->
    
    @if(isLoading()) {
      <app-spinner></app-spinner> <!-- O su respectivo Skeleton -->
    }
    
    @if(error()) {
      <div class="alert alert-error">{{ error() }}</div>
    }
    <!-- Solo muestra los instructores activos gracias al Computed Signal -->
    @for(instructor of instructoresActivos(); track instructor.id) {
       <app-instructor-card [info]="instructor"></app-instructor-card>
    }
  `
})
export class InstructoresListComponent implements OnInit {
  // Inyección del Facade (El intermediario único)
  private instructoresFacade = inject(InstructoresFacade);
  // Exposición de Signals de solo lectura a nuestro HTML
  public instructoresActivos = this.instructoresFacade.instructoresActivos;
  public isLoading = this.instructoresFacade.isLoading;
  public error = this.instructoresFacade.error;
  ngOnInit() {
    // Le pedimos al Facade que lance la llamada de red.
    // Nosotros en este componente NO esperamos la respuesta (no hay 'await'). 
    // Simplemente reaccionamos cuando el Signal internamente se actualice.
    this.instructoresFacade.cargarInstructores();
  }
}
4. Resumen de Flujo para el Equipo Mente-Máquina:
Pregunta: "¿Necesito traer datos de la Tabla X para mostrarlos o editarlos?"
Acción 1: Buscar en core/services/ si ya existe un X.facade.ts.
Acción 2 (Si no existe): Crear <Dominio>Facade. (Añadir la query y el signal()).
Acción 3: Inyectar el <Dominio>Facade en el componente.
Acción 4: Disparar un método del Facade (ej: cargar(), guardar()) y dejar que la UI se actualice sola por reactividad (OnPush).