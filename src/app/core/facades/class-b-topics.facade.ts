import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { ToastService } from '@core/services/ui/toast.service';
import type { ClassBTopic } from '@core/models/dto/class-b-topics.model';

/**
 * Malla de temas de las 12 clases prácticas Clase B (ASG-m-007, fix-169-b).
 *
 * Los temas son fijos por número de clase y editables solo por admin. Se leen en dos
 * lugares distintos (ficha técnica del detalle de alumno y portal del instructor), así
 * que viven acá y no dentro del facade de una de esas vistas.
 */
@Injectable({ providedIn: 'root' })
export class ClassBTopicsFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly toast = inject(ToastService);

  // 1. ESTADO REACTIVO (privado)
  private readonly _topics = signal<ClassBTopic[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  /** SWR: la malla cambia muy de vez en cuando; no se muestra skeleton en re-entradas. */
  private _initialized = false;

  // 2. ESTADO EXPUESTO (público, solo lectura)
  readonly topics = this._topics.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Lookup por número de clase, para que las vistas no recorran el array por fila. */
  readonly topicsByClassNumber = computed(() => {
    const dict = new Map<number, string>();
    for (const t of this._topics()) dict.set(t.class_number, t.topic);
    return dict;
  });

  // 3. MÉTODOS DE ACCIÓN
  async initialize(): Promise<void> {
    if (this._initialized) {
      await this.refreshSilently();
      return;
    }
    this._initialized = true;

    this._isLoading.set(true);
    try {
      await this.fetchTopics();
    } catch (err) {
      this.setError(err, 'No se pudo cargar la malla de temas de Clase B.');
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Refresca sin skeleton: los datos que ya están en pantalla siguen sirviendo. */
  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchTopics();
    } catch {
      // Fail silencioso: es preferible la malla stale a vaciar la pantalla.
    }
  }

  private async fetchTopics(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('class_b_topics')
      .select('id, class_number, topic, created_at, updated_at')
      .order('class_number', { ascending: true });

    if (error) throw error;
    this._error.set(null);
    this._topics.set(data ?? []);
  }

  /**
   * Cambia el tema de una clase. Solo admin: la policy de UPDATE lo exige, así que un
   * intento de otro rol vuelve como error de RLS y no como un cambio silencioso.
   */
  async updateTopic(classNumber: number, newTopic: string): Promise<boolean> {
    const topic = newTopic.trim();
    if (!topic) {
      this._error.set('El tema no puede quedar vacío.');
      this.toast.error('El tema no puede quedar vacío.');
      return false;
    }

    try {
      const { data, error } = await this.supabase.client
        .from('class_b_topics')
        .update({ topic })
        .eq('class_number', classNumber)
        .select('id, class_number, topic, created_at, updated_at')
        .maybeSingle();

      if (error) throw error;
      // `maybeSingle()` y no `single()`: si la RLS filtra la fila, `single()` tira error
      // de "0 filas" y se reporta como fallo de red en vez de falta de permiso.
      if (!data)
        throw new Error('No se pudo actualizar el tema: sin permisos o la clase no existe.');

      this._error.set(null);
      this._topics.update((topics) =>
        topics.map((t) => (t.class_number === classNumber ? data : t)),
      );
      this.toast.success(`Tema de la clase ${classNumber} actualizado.`);
      return true;
    } catch (err) {
      this.setError(err, 'No se pudo actualizar el tema de la clase.');
      return false;
    }
  }

  private setError(err: unknown, fallback: string): void {
    const msg = err instanceof Error ? this.sanitizer.sanitize(err).message : fallback;
    this._error.set(msg);
    this.toast.error(msg);
  }
}
