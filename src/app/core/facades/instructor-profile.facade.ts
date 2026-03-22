import { Injectable, signal, computed, inject } from '@angular/core';
import { AuthFacade } from './auth.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type { Instructor } from '@core/models/dto/instructor.model';

@Injectable({
  providedIn: 'root'
})
export class InstructorProfileFacade {
  private authFacade = inject(AuthFacade);
  private supabase = inject(SupabaseService);

  private _instructorId = signal<number | null>(null);
  private _instructorData = signal<Instructor | null>(null);
  private _vehicle = signal<{id: number, plate: string, label: string} | null>(null);
  private _initialized = false;
  private _isLoading = signal<boolean>(false);

  readonly instructorId = this._instructorId.asReadonly();
  readonly instructorData = this._instructorData.asReadonly();
  readonly vehicle = this._vehicle.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  async initialize(): Promise<void> {
    if (this._initialized) return;
    
    // Wait for auth to be ready
    await this.authFacade.whenReady;
    const user = this.authFacade.currentUser();
    
    if (!user || user.role !== 'instructor' || !user.dbId) {
      console.warn('InstructorProfileFacade: User is not an authenticated instructor.');
      return;
    }

    this._isLoading.set(true);

    try {
      // 1. Fetch instructor
      const { data: instructorData, error: instructorError } = await this.supabase.client
        .from('instructors')
        .select('*')
        .eq('user_id', user.dbId)
        .maybeSingle();

      if (instructorError) throw instructorError;
      
      if (instructorData) {
        this._instructorId.set(instructorData.id);
        this._instructorData.set(instructorData as Instructor);

        // 2. Fetch assigned vehicle (active assignment)
        const { data: assignments, error: vehicleError } = await this.supabase.client
          .from('vehicle_assignments')
          .select('vehicle_id, vehicles(id, license_plate, brand, model)')
          .eq('instructor_id', instructorData.id)
          .is('end_date', null)
          .maybeSingle();

        if (vehicleError && vehicleError.code !== 'PGRST116') { // Ignorar error de no encontrar si no hay auto
          console.error('Error fetching vehicle assignment:', vehicleError);
        }

        if (assignments && assignments.vehicles) {
          const v = assignments.vehicles as any;
          this._vehicle.set({
            id: v.id,
            plate: v.license_plate,
            label: `${v.brand || ''} ${v.model || ''}`.trim() || 'Vehículo'
          });
        }
      }
      
      this._initialized = true;
    } catch (err) {
      console.error('Error initializing InstructorProfileFacade', err);
    } finally {
      this._isLoading.set(false);
    }
  }

  async getInstructorId(): Promise<number | null> {
    if (!this._initialized) {
      await this.initialize();
    }
    return this._instructorId();
  }
}
