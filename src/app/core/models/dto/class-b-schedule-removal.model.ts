/**
 * spec 0058-b — tabla `class_b_schedule_removals`: cada "Eliminar horario" de una matrícula.
 * "Reactivar horario" deshace solo la última.
 */
export interface ClassBScheduleRemoval {
  id: number;
  enrollment_id: number;
  removed_at: string;
  removed_by: number | null;
  /** `enrollments.absence_penalty_applied_at` antes de eliminar (null = no había). */
  previous_penalty_applied_at: string | null;
  reactivated_at: string | null;
  reactivated_by: number | null;
  created_at: string;
}

/** Última eliminación de una matrícula, con el nombre de quien la hizo (modal de Reactivar). */
export type UltimaEliminacionRow = Pick<
  ClassBScheduleRemoval,
  'id' | 'removed_at' | 'reactivated_at'
> & {
  removed_by_user: { first_names: string | null; paternal_last_name: string | null } | null;
};

/** Fila que devuelve la RPC `remove_class_b_schedule` (una por matrícula afectada). */
export interface RemoveScheduleResultRow {
  enrollment_id: number;
  removal_id: number;
  cancelled_count: number;
  first_scheduled_at: string | null;
  student_user_id: number | null;
  instructor_user_ids: number[];
}

/** Fila única que devuelve la RPC `reactivate_class_b_schedule`. */
export interface ReactivateScheduleResultRow {
  reactivated_count: number;
  first_scheduled_at: string | null;
  student_user_id: number | null;
  instructor_user_ids: number[];
  previous_penalty_applied_at: string | null;
}
