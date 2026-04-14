import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import type { ProfessionalPreRegistration } from '@core/models/dto/professional-pre-registration.model';
import type { ProfessionalPromotion } from '@core/models/dto/professional-promotion.model';
import type { PromotionCourse } from '@core/models/dto/promotion-course.model';
import type { User } from '@core/models/dto/user.model';
import type { Branch } from '@core/models/dto/branch.model';
import type { Course } from '@core/models/dto/course.model';
import type {
  PreInscritoTableRow,
  EvaluarTestPayload,
  CompletarMatriculaPayload,
  PromocionOption,
  PromocionCourseOption,
} from '@core/models/ui/pre-inscrito-table.model';

// ─── Raw join types (formas de retorno de queries con JOIN) ──────────────────

type RawUser = Pick<
  User,
  | 'id'
  | 'rut'
  | 'first_names'
  | 'paternal_last_name'
  | 'maternal_last_name'
  | 'email'
  | 'phone'
  | 'branch_id'
> & { branches: Pick<Branch, 'id' | 'name'> | null };

type RawEvaluator = Pick<User, 'first_names' | 'paternal_last_name'>;

interface RawPreInscrito extends ProfessionalPreRegistration {
  users: RawUser;
  evaluator: RawEvaluator | null;
  enrollment: { id: number; number: string } | null;
}

type RawPromotionCourse = Pick<PromotionCourse, 'id' | 'course_id' | 'max_students'> & {
  courses: Pick<Course, 'id' | 'name' | 'code' | 'license_class' | 'base_price'> | null;
  enrollments: { id: number }[];
};

type RawPromocion = Pick<ProfessionalPromotion, 'id' | 'start_date'> & {
  code: string;
  name: string;
  end_date: string;
  status: 'planned' | 'in_progress';
  promotion_courses: RawPromotionCourse[];
};

// ─── Facade ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AdminPreInscritosFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly branchFacade = inject(BranchFacade);
  private readonly authFacade = inject(AuthFacade);

  // ── 1. ESTADO PRIVADO ────────────────────────────────────────────────────
  private readonly _preInscritos = signal<PreInscritoTableRow[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _isSaving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _selected = signal<PreInscritoTableRow | null>(null);
  private readonly _promociones = signal<PromocionOption[]>([]);
  private readonly _promocionesCargadas = signal(false);
  private readonly _promocionesCargando = signal(false);

  private _initialized = false;
  private _lastBranchId: number | null | undefined = undefined;

  // ── 2. ESTADO PÚBLICO ────────────────────────────────────────────────────
  readonly preInscritos = this._preInscritos.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly selected = this._selected.asReadonly();
  readonly promociones = this._promociones.asReadonly();
  readonly promocionesCargando = this._promocionesCargando.asReadonly();

  // KPIs
  readonly total = computed(() => this._preInscritos().length);
  readonly pendientesTest = computed(
    () => this._preInscritos().filter((p) => p.psychResult === null).length,
  );
  readonly aprobados = computed(
    () => this._preInscritos().filter((p) => p.status === 'approved').length,
  );

  // ── 3. MÉTODOS DE ACCIÓN ─────────────────────────────────────────────────

  /** SWR: primer acceso con skeleton, re-visitas con refresh silencioso. */
  async initialize(): Promise<void> {
    const branchId = this.branchFacade.selectedBranchId();

    if (this._initialized && branchId === this._lastBranchId) {
      void this.refreshSilently();
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);
    try {
      await this.fetchData(branchId);
      this._initialized = true;
      this._lastBranchId = branchId;
    } catch {
      this._error.set('Error al cargar pre-inscritos');
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Selecciona un pre-inscrito para abrir su drawer. */
  select(row: PreInscritoTableRow | null): void {
    this._selected.set(row);
  }

  /**
   * Guarda la evaluación del test psicológico de forma INDEPENDIENTE.
   * Actualiza status → 'approved' (fit) o 'rejected' (unfit).
   * Esta acción puede ocurrir días antes de completar la matrícula.
   */
  async evaluarTest(payload: EvaluarTestPayload): Promise<boolean> {
    this._isSaving.set(true);
    this._error.set(null);
    try {
      const currentUser = this.authFacade.currentUser();
      const now = new Date().toISOString();
      const newStatus = payload.result === 'fit' ? 'approved' : 'rejected';

      const { error } = await this.supabase.client
        .from('professional_pre_registrations')
        .update({
          psych_test_result: payload.result,
          psych_evaluated_by: currentUser?.dbId ?? null,
          psych_evaluated_at: now,
          psych_rejection_reason: payload.rejectionReason ?? null,
          status: newStatus,
        })
        .eq('id', payload.preInscritoId);

      if (error) throw error;

      await this.refreshSilently();

      // Actualizar el selected para reflejar cambio inmediato en el drawer
      const updated = this._preInscritos().find((p) => p.id === payload.preInscritoId) ?? null;
      this._selected.set(updated);

      return true;
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Error al guardar evaluación');
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * Completa la matrícula presencial de un pre-inscrito aprobado.
   * Operaciones en secuencia:
   *   1. Asegurar registro en `students`
   *   2. Activar usuario y asignar rol 'student'
   *   3. Generar número de matrícula y crear `enrollments`
   *   4. Marcar pre-inscripción como 'enrolled'
   */
  /**
   * Retorna `{ enrollmentId, enrollmentNumber }` al éxito, o `null` en error.
   * No cierra el drawer — el Smart Component decide qué hacer con el resultado.
   */
  async completarMatricula(
    payload: CompletarMatriculaPayload,
  ): Promise<{ enrollmentId: number; enrollmentNumber: string } | null> {
    this._isSaving.set(true);
    this._error.set(null);
    const preReg = this._preInscritos().find((p) => p.id === payload.preInscritoId);
    if (!preReg) {
      this._error.set('Pre-inscrito no encontrado');
      this._isSaving.set(false);
      return null;
    }

    try {
      const currentUser = this.authFacade.currentUser();

      // 1. Asegurar registro en students (puede no existir para pre-inscritos online)
      // birth_date y gender vienen del formulario público, ya guardados en pre-registration
      const studentId = await this.ensureStudentRecord(
        preReg.tempUserId,
        payload,
        preReg.birthDate,
        preReg.gender,
        preReg.address,
      );

      // 2. Activar usuario y asignar rol 'student'
      const { data: roles } = await this.supabase.client
        .from('roles')
        .select('id')
        .eq('name', 'student')
        .single();

      await this.supabase.client
        .from('users')
        .update({
          role_id: roles?.id ?? null,
          active: true,
          branch_id: preReg.branchId,
        })
        .eq('id', preReg.tempUserId);

      // 3. Generar número de matrícula y crear enrollment
      const enrollmentNumber = await this.generateEnrollmentNumber(payload.courseId);

      const { data: enrollment, error: enrollError } = await this.supabase.client
        .from('enrollments')
        .insert({
          number: enrollmentNumber,
          student_id: studentId,
          course_id: payload.courseId,
          branch_id: preReg.branchId,
          promotion_course_id: payload.promotionCourseId,
          base_price: payload.basePrice,
          discount: payload.discountAmount,
          total_paid: payload.totalPaid,
          pending_balance: Math.max(
            0,
            payload.basePrice - payload.discountAmount - payload.totalPaid,
          ),
          payment_status:
            payload.paymentMethod === 'pendiente'
              ? 'pending'
              : payload.totalPaid >= payload.basePrice - payload.discountAmount
                ? 'paid'
                : 'partial',
          status: 'active',
          docs_complete: false,
          contract_accepted: false,
          registration_channel: 'in_person',
          registered_by: currentUser?.dbId ?? null,
        })
        .select('id')
        .single();

      if (enrollError) throw enrollError;

      // 4. Marcar pre-inscripción como pendiente de contrato
      const { error: preRegError } = await this.supabase.client
        .from('professional_pre_registrations')
        .update({
          status: 'pending_contract',
          converted_enrollment_id: enrollment.id,
        })
        .eq('id', payload.preInscritoId);

      if (preRegError) throw preRegError;

      // 5. Subir documentos al storage y registrar en student_documents
      const enrollmentId = enrollment.id;
      const docsUploaded = await this.uploadEnrollmentDocuments(enrollmentId, payload);

      // Si se subieron los obligatorios, marcar docs_complete
      if (docsUploaded.carnet && docsUploaded.hvc) {
        await this.supabase.client
          .from('enrollments')
          .update({ docs_complete: true })
          .eq('id', enrollmentId);
      }

      // 6. Subir contrato firmado si se proporcionó
      if (payload.contractFile) {
        await this.uploadContractFile(enrollmentId, payload.contractFile);
      }

      await this.refreshSilently();

      // Actualizar _selected para que el drawer refleje el nuevo status y enrollmentNumber
      const updated = this._preInscritos().find((p) => p.id === payload.preInscritoId) ?? null;
      this._selected.set(updated);

      return { enrollmentId: enrollment.id, enrollmentNumber };
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Error al completar matrícula');
      return null;
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * Genera el PDF del contrato para un enrollment ya creado,
   * invocando la Edge Function `generate-contract-pdf`.
   * Retorna la URL del PDF o null en error.
   */
  async generateContract(enrollmentId: number): Promise<string | null> {
    this._isSaving.set(true);
    this._error.set(null);
    try {
      const { data, error } = await this.supabase.client.functions.invoke('generate-contract-pdf', {
        body: { enrollment_id: enrollmentId },
      });
      if (error) {
        this._error.set('Error al generar contrato: ' + error.message);
        return null;
      }
      return (data as { pdfUrl: string }).pdfUrl ?? null;
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Error al generar contrato');
      return null;
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * Sube el contrato firmado y actualiza digital_contracts + contract_accepted.
   */
  async uploadSignedContract(enrollmentId: number, file: File): Promise<boolean> {
    this._isSaving.set(true);
    this._error.set(null);
    try {
      await this.uploadContractFile(enrollmentId, file);

      // Marcar la pre-inscripción como completamente matriculada
      const preReg = this._preInscritos().find((p) => p.convertedEnrollmentId === enrollmentId);
      if (preReg) {
        await this.supabase.client
          .from('professional_pre_registrations')
          .update({ status: 'enrolled' })
          .eq('id', preReg.id);
      }

      // Refrescar lista silenciosamente — el alumno desaparece del listado
      await this.refreshSilently();

      return true;
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Error al subir contrato');
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * Carga promociones activas (planned | in_progress) compatibles con
   * la clase de licencia del pre-inscrito seleccionado.
   * Solo se carga una vez por sesión de drawer (lazy).
   */
  async cargarPromocionesParaLicencia(licencia: string): Promise<void> {
    if (this._promocionesCargadas()) return;
    this._promocionesCargando.set(true);
    try {
      const branchId = this.branchFacade.selectedBranchId();

      let query = this.supabase.client
        .from('professional_promotions')
        .select(
          `
          id, code, name, start_date, end_date, status,
          promotion_courses(
            id, course_id, max_students,
            courses(id, name, code, license_class, base_price),
            enrollments(id)
          )
        `,
        )
        .in('status', ['planned', 'in_progress'])
        .order('start_date', { ascending: false });

      if (branchId !== null) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = ((data ?? []) as unknown as RawPromocion[])
        .map((p) => this.mapToPromocionOption(p, licencia))
        .filter((p) => p.courses.length > 0);

      this._promociones.set(rows);
      this._promocionesCargadas.set(true);
    } catch (err) {
      console.error('cargarPromocionesParaLicencia error:', err);
      this._promocionesCargadas.set(true);
    } finally {
      this._promocionesCargando.set(false);
    }
  }

  resetPromocionesCache(): void {
    this._promocionesCargadas.set(false);
    this._promocionesCargando.set(false);
    this._promociones.set([]);
  }

  clearError(): void {
    this._error.set(null);
  }

  // ── Privados ─────────────────────────────────────────────────────────────

  private async fetchData(branchId: number | null): Promise<void> {
    let query = this.supabase.client
      .from('professional_pre_registrations')
      .select(
        `
        *,
        users!temp_user_id(
          id, rut, first_names, paternal_last_name, maternal_last_name,
          email, phone, branch_id,
          branches(id, name)
        ),
        evaluator:users!psych_evaluated_by(first_names, paternal_last_name),
        enrollment:enrollments!converted_enrollment_id(id, number)
      `,
      )
      .neq('status', 'enrolled')
      .order('registered_at', { ascending: false });

    if (branchId !== null) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = ((data ?? []) as unknown as RawPreInscrito[]).map((r) => this.mapToRow(r));
    this._preInscritos.set(rows);
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchData(this.branchFacade.selectedBranchId());
    } catch {
      // Swallowed — datos stale siguen visibles
    }
  }

  private async ensureStudentRecord(
    userId: number,
    payload: CompletarMatriculaPayload,
    birthDate: string | null,
    gender: 'M' | 'F' | null,
    address: string | null,
  ): Promise<number> {
    const { data: existing } = await this.supabase.client
      .from('students')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: created, error } = await this.supabase.client
      .from('students')
      .insert({
        user_id: userId,
        birth_date: birthDate,
        gender: gender,
        address: address,
        current_license_class: payload.currentLicenseClass,
        license_obtained_date: payload.licenseObtainedDate,
        status: 'active',
      })
      .select('id')
      .single();

    if (error) throw error;
    return created.id;
  }

  private async generateEnrollmentNumber(courseId: number): Promise<string> {
    const { data, error } = await this.supabase.client.rpc('get_next_enrollment_number', {
      p_course_id: courseId,
    });

    if (error) throw new Error('Error al generar número de matrícula: ' + error.message);
    return data as string;
  }

  /**
   * Sube los documentos del expediente al storage y los registra en student_documents.
   * Retorna qué documentos obligatorios se subieron exitosamente.
   */
  private async uploadEnrollmentDocuments(
    enrollmentId: number,
    payload: CompletarMatriculaPayload,
  ): Promise<{ carnet: boolean; hvc: boolean }> {
    const result = { carnet: false, hvc: false };

    // Foto carnet (obligatoria)
    if (payload.carnetPhotoFile) {
      try {
        const filePath = `students/${enrollmentId}/id_photo`;
        const { error } = await this.supabase.client.storage
          .from('documents')
          .upload(filePath, payload.carnetPhotoFile, { upsert: true });
        if (!error) {
          await this.supabase.client.from('student_documents').upsert(
            {
              enrollment_id: enrollmentId,
              type: 'id_photo',
              file_name: payload.carnetPhotoFile.name,
              storage_url: filePath,
              status: 'approved',
              uploaded_at: new Date().toISOString(),
            },
            { onConflict: 'enrollment_id,type' },
          );
          result.carnet = true;
        }
      } catch {
        /* no-op, carnet opcional en upload pero requerido en UI */
      }
    }

    // Hoja de vida del conductor (obligatoria)
    if (payload.hvcFile) {
      try {
        const filePath = `students/${enrollmentId}/hoja_vida_conductor`;
        const { error } = await this.supabase.client.storage
          .from('documents')
          .upload(filePath, payload.hvcFile, { upsert: true });
        if (!error) {
          await this.supabase.client.from('student_documents').upsert(
            {
              enrollment_id: enrollmentId,
              type: 'hoja_vida_conductor',
              file_name: payload.hvcFile.name,
              storage_url: filePath,
              status: 'pending',
              document_issue_date: payload.hvcIssueDate ?? null,
              uploaded_at: new Date().toISOString(),
            },
            { onConflict: 'enrollment_id,type' },
          );
          result.hvc = true;
        }
      } catch {
        /* no-op */
      }
    }

    // Cédula de identidad (opcional)
    if (payload.cedulaFile) {
      try {
        const filePath = `students/${enrollmentId}/cedula_identidad`;
        const { error } = await this.supabase.client.storage
          .from('documents')
          .upload(filePath, payload.cedulaFile, { upsert: true });
        if (!error) {
          await this.supabase.client.from('student_documents').upsert(
            {
              enrollment_id: enrollmentId,
              type: 'cedula_identidad',
              file_name: payload.cedulaFile.name,
              storage_url: filePath,
              status: 'pending',
              uploaded_at: new Date().toISOString(),
            },
            { onConflict: 'enrollment_id,type' },
          );
        }
      } catch {
        /* no-op */
      }
    }

    // Licencia de conducir (opcional)
    if (payload.licenciaFile) {
      try {
        const filePath = `students/${enrollmentId}/licencia_conducir`;
        const { error } = await this.supabase.client.storage
          .from('documents')
          .upload(filePath, payload.licenciaFile, { upsert: true });
        if (!error) {
          await this.supabase.client.from('student_documents').upsert(
            {
              enrollment_id: enrollmentId,
              type: 'licencia_conducir',
              file_name: payload.licenciaFile.name,
              storage_url: filePath,
              status: 'pending',
              uploaded_at: new Date().toISOString(),
            },
            { onConflict: 'enrollment_id,type' },
          );
        }
      } catch {
        /* no-op */
      }
    }

    return result;
  }

  /**
   * Sube el contrato firmado al storage y registra en digital_contracts.
   */
  private async uploadContractFile(enrollmentId: number, file: File): Promise<void> {
    try {
      const filePath = `contracts/${enrollmentId}/signed_contract`;
      const { error } = await this.supabase.client.storage
        .from('documents')
        .upload(filePath, file, { upsert: true });
      if (error) return;

      const now = new Date().toISOString();
      await this.supabase.client.from('digital_contracts').upsert(
        {
          enrollment_id: enrollmentId,
          file_name: file.name,
          file_url: filePath,
          accepted_at: now,
        },
        { onConflict: 'enrollment_id' },
      );

      await this.supabase.client
        .from('enrollments')
        .update({ contract_accepted: true })
        .eq('id', enrollmentId);
    } catch {
      /* no-op */
    }
  }

  private mapToRow(r: RawPreInscrito): PreInscritoTableRow {
    const u = r.users;
    const nombreCompleto =
      `${u.first_names} ${u.paternal_last_name} ${u.maternal_last_name}`.trim();
    const now = new Date();
    const expires = new Date(r.expires_at);
    const diffMs = expires.getTime() - now.getTime();
    const diasParaVencer = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isVencido = diasParaVencer < 0;

    return {
      id: r.id,
      tempUserId: r.temp_user_id,
      nombre: u.first_names,
      apellido: `${u.paternal_last_name} ${u.maternal_last_name}`.trim(),
      nombreCompleto,
      rut: u.rut,
      email: u.email,
      telefono: u.phone ?? '',
      licencia: r.requested_license_class ?? r.desired_course_class ?? '—',
      branchId: r.branch_id ?? 0,
      sucursal: u.branches?.name ?? '—',
      canal: r.registration_channel,
      convalida: r.convalidates_simultaneously,
      fechaPreInscripcion: r.registered_at.slice(0, 10),
      fechaVencimiento: r.expires_at.slice(0, 10),
      isVencido,
      diasParaVencer: isVencido ? null : diasParaVencer,
      status: r.status,
      statusLabel: this.statusLabel(r.status),
      statusSeverity: this.statusSeverity(r.status),
      psychResult: r.psych_test_result,
      psychResultLabel: this.psychResultLabel(r.psych_test_result),
      psychAnswers: r.psych_test_answers,
      psychEvaluatedAt: r.psych_evaluated_at,
      psychEvaluatedByName: r.evaluator
        ? `${r.evaluator.first_names} ${r.evaluator.paternal_last_name}`
        : null,
      psychRejectionReason: r.psych_rejection_reason,
      convertedEnrollmentId: r.converted_enrollment_id,
      enrollmentNumber: r.enrollment?.number ?? null,
      notes: r.notes,
      birthDate: r.birth_date ?? null,
      gender: (r.gender as 'M' | 'F') ?? null,
      address: r.address ?? null,
    };
  }

  private mapToPromocionOption(r: RawPromocion, licencia: string): PromocionOption {
    const courses: PromocionCourseOption[] = (r.promotion_courses ?? [])
      .filter((pc) => pc.courses?.license_class === licencia)
      .map((pc) => ({
        promotionCourseId: pc.id,
        courseId: pc.course_id,
        courseCode: pc.courses?.code ?? '',
        courseName: pc.courses?.name ?? '',
        enrolledStudents: pc.enrollments?.length ?? 0,
        maxStudents: pc.max_students,
        available: pc.max_students - (pc.enrollments?.length ?? 0),
        basePrice: pc.courses?.base_price ?? 0,
      }));

    return {
      id: r.id,
      code: r.code,
      name: r.name,
      startDate: r.start_date,
      endDate: r.end_date,
      status: r.status,
      courses,
    };
  }

  private statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending_review: 'Pendiente revisión',
      approved: 'Aprobado',
      pending_contract: 'Pendiente contrato',
      enrolled: 'Matriculado',
      expired: 'Vencido',
      rejected: 'Rechazado',
    };
    return map[status] ?? status;
  }

  private statusSeverity(status: string): 'warn' | 'success' | 'danger' | 'info' | 'secondary' {
    const map: Record<string, 'warn' | 'success' | 'danger' | 'info' | 'secondary'> = {
      pending_review: 'warn',
      approved: 'info',
      pending_contract: 'warn',
      enrolled: 'success',
      expired: 'danger',
      rejected: 'danger',
    };
    return map[status] ?? 'secondary';
  }

  private psychResultLabel(result: string | null): string {
    if (result === 'fit') return 'Apto';
    if (result === 'unfit') return 'No Apto';
    return 'Sin evaluar';
  }
}
