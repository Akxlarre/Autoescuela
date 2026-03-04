import { ChangeDetectionStrategy, Component, computed, inject, model, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StepperModule } from 'primeng/stepper';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

/**
 * Wizard "Nueva Matrícula" — 6 pasos
 * RF-006/007/010/062/063/082/083
 *
 * SCOPE: Solo UI/UX presentacional con datos hardcodeados.
 * No inyecta Facades ni Services.
 */
@Component({
  selector: 'app-secretaria-matricula',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    StepperModule,
    InputTextModule,
    SelectModule,
    DatePickerModule,
    CheckboxModule,
    ButtonModule,
    InputNumberModule,
    TextareaModule,
    IconComponent,
    AlertCardComponent,
  ],
  styleUrls: ['./secretaria-matricula.component.scss'],
  templateUrl: './secretaria-matricula.component.html',
})
export class SecretariaMatriculaComponent implements OnInit, OnDestroy {
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  // ── Stepper ────────────────────────────────────────────────
  readonly activeStep = model(0);

  readonly stepperClass = computed(
    () => `stepper-premium stepper-premium--step-${this.activeStep() + 1}`,
  );

  /** Etiqueta del paso actual para el indicador de progreso */
  readonly progressLabel = computed(() => {
    const labels = ['Datos Personales', 'Adscripción', 'Documentos', 'Pago', 'Contrato', 'Confirmación'];
    return labels[this.activeStep()] ?? '';
  });

  // ── Paso 1: Datos Personales ───────────────────────────────
  readonly rut = model('');
  readonly nombres = model('');
  readonly apellidos = model('');
  readonly email = model('');
  readonly telefono = model('');
  readonly fechaNacimiento = model<Date | null>(null);
  readonly sexo = model('M');
  readonly direccion = model('');
  readonly region = model('16');
  readonly comuna = model('chillan');

  readonly sexoOptions = [
    { label: 'Masculino', value: 'M' },
    { label: 'Femenino', value: 'F' },
  ];

  readonly regionOptions = [
    { label: 'Ñuble', value: '16' },
    { label: 'Biobío', value: '08' },
    { label: 'Metropolitana', value: '13' },
  ];

  readonly comunaOptions = [
    { label: 'Chillán', value: 'chillan' },
    { label: 'Chillán Viejo', value: 'chillan-viejo' },
    { label: 'San Carlos', value: 'san-carlos' },
  ];

  readonly edadAlumno = computed(() => {
    const fecha = this.fechaNacimiento();
    if (!fecha) return null;
    const hoy = new Date();
    return Math.floor((hoy.getTime() - fecha.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  });

  readonly edadAlerta = computed<'block' | 'menor' | 'ok' | null>(() => {
    const edad = this.edadAlumno();
    if (edad === null) return null;
    if (edad < 17) return 'block';
    if (edad === 17) return 'menor';
    return 'ok';
  });

  readonly esMenor = computed(() => this.edadAlerta() === 'menor');

  // ── Paso 2: Adscripción ────────────────────────────────────
  readonly categoriaCurso = model<'no-profesional' | 'profesional' | 'singular'>('no-profesional');
  readonly tipoCurso = model('clase_b');
  readonly codigoSence = model('');

  // -- Requisitos Profesionales (RF-062, RF-063) --
  readonly fechaObtencionClaseB = model<Date | null>(null);
  readonly tieneLicenciaProfesionalPrevia = model<'ninguna' | 'a2' | 'a4'>('ninguna');
  readonly fechaObtencionLicenciaPrevia = model<Date | null>(null);

  readonly antiguedadClaseB = computed(() => {
    const fecha = this.fechaObtencionClaseB();
    if (!fecha) return 0;
    const hoy = new Date();
    return Math.floor((hoy.getTime() - fecha.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  });

  readonly antiguedadProfesionalPrevia = computed(() => {
    const fecha = this.fechaObtencionLicenciaPrevia();
    if (!fecha) return 0;
    const hoy = new Date();
    return Math.floor((hoy.getTime() - fecha.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  });

  /** Validación RF-062: > 20 años y > 2 años Clase B para A2 o A4 */
  readonly errorA2A4 = computed(() => {
    const tipo = this.tipoCurso();
    if (tipo !== 'profesional_a2' && tipo !== 'profesional_a4') return null;

    const edad = this.edadAlumno() ?? 0;
    const antiguedad = this.antiguedadClaseB();

    if (edad < 20) return 'la-edad';
    if (this.fechaObtencionClaseB() && antiguedad < 2) return 'la-antiguedad';
    if (!this.fechaObtencionClaseB()) return 'falta-fecha';
    return null;
  });

  /** Validación RF-063: > 2 años con A2 o A4 para A3 o A5 */
  readonly errorA3A5 = computed(() => {
    const tipo = this.tipoCurso();
    if (tipo !== 'profesional_a3' && tipo !== 'profesional_a5') return null;

    const previa = this.tieneLicenciaProfesionalPrevia();
    const antiguedad = this.antiguedadProfesionalPrevia();

    if (previa === 'ninguna') return 'falta-previa';
    if (this.fechaObtencionLicenciaPrevia() && antiguedad < 2) return 'la-antiguedad';
    if (!this.fechaObtencionLicenciaPrevia()) return 'falta-fecha';
    return null;
  });

  readonly bloqueoInscripcionProfesional = computed(() => {
    const errA2A4 = this.errorA2A4();
    const errA3A5 = this.errorA3A5();

    if (errA2A4 === 'la-edad' || errA2A4 === 'la-antiguedad') return true;
    if (errA3A5 === 'la-antiguedad') return true;
    return false;
  });

  readonly esProfesional = computed(() => this.categoriaCurso() === 'profesional');


  readonly cursosDisponibles = computed(() => {
    const cat = this.categoriaCurso();
    if (cat === 'profesional') {
      return [
        { value: 'profesional_a2', label: 'Profesional A2', desc: 'Transporte público' },
        { value: 'profesional_a3', label: 'Profesional A3', desc: 'Vehículos pesados' },
        { value: 'profesional_a4', label: 'Profesional A4', desc: 'Transporte remunerado' },
        { value: 'profesional_a5', label: 'Profesional A5', desc: 'Vehículos articulados' },
      ];
    }
    if (cat === 'singular') {
      return [{ value: 'singular', label: 'Curso Singular', desc: 'Personalizado' }];
    }
    return [
      { value: 'clase_b', label: 'Clase B', desc: 'Vehículos particulares' },
      { value: 'clase_b_sence', label: 'Clase B + SENCE', desc: 'Con código SENCE' },
    ];
  });

  readonly esSence = computed(() => this.tipoCurso() === 'clase_b_sence');

  readonly senceOptions = [
    { label: '12345678-9 — Conducción Clase B', value: '12345678-9' },
    { label: '87654321-0 — Conducción defensiva', value: '87654321-0' },
    { label: '11223344-5 — Clase B inicial', value: '11223344-5' },
  ];

  readonly cursoResumen = computed(() => {
    const tipo = this.tipoCurso();
    const labels: Record<string, { tipo: string; duracion: string; practicas: string; teoricas: string; valor: number }> = {
      clase_b: { tipo: 'Clase B', duracion: '8 semanas', practicas: '18 horas', teoricas: '12 horas', valor: 280000 },
      clase_b_sence: { tipo: 'Clase B + SENCE', duracion: '8 semanas', practicas: '18 horas', teoricas: '12 horas', valor: 280000 },
      profesional_a2: { tipo: 'Profesional A2', duracion: '12 semanas', practicas: '24 horas', teoricas: '20 horas', valor: 450000 },
      profesional_a3: { tipo: 'Profesional A3', duracion: '12 semanas', practicas: '24 horas', teoricas: '20 horas', valor: 450000 },
      profesional_a4: { tipo: 'Profesional A4', duracion: '10 semanas', practicas: '20 horas', teoricas: '16 horas', valor: 380000 },
      profesional_a5: { tipo: 'Profesional A5', duracion: '14 semanas', practicas: '28 horas', teoricas: '24 horas', valor: 520000 },
      singular: { tipo: 'Singular', duracion: 'Variable', practicas: 'Variable', teoricas: 'Variable', valor: 200000 },
    };
    return labels[tipo] ?? labels['clase_b'];
  });

  // ── Paso 3: Documentos ─────────────────────────────────────
  readonly fotoSubida = signal(false);
  readonly fotoPreviewUrl = signal<string | null>(null);
  readonly fotoTab = signal<'camara' | 'subir'>('subir');
  readonly autorizacionSubida = signal(false);
  readonly hojaVidaSubida = signal(false);
  readonly hvcFechaEmision = signal<Date | null>(null);
  readonly cedulaSubida = signal(false);
  readonly licenciaSubida = signal(false);
  readonly certMedicoSubido = signal(false);
  readonly examPsicologicoSubido = signal(false);
  readonly certSemepSubido = signal(false);

  readonly hvcMasDe30Dias = computed(() => {
    const fecha = this.hvcFechaEmision();
    if (!fecha) return false;
    const dias = Math.floor((new Date().getTime() - fecha.getTime()) / 86400000);
    return dias > 30;
  });

  // ── Paso 4: Pago ───────────────────────────────────────────
  readonly tieneDescuento = model(false);
  readonly montoDescuento = model<number>(0);
  readonly motivoDescuento = model('');
  readonly metodoPago = model('efectivo');

  readonly precioBase = computed(() => this.cursoResumen().valor);

  readonly totalPagar = computed(() => {
    const base = this.precioBase();
    const desc = this.tieneDescuento() ? (this.montoDescuento() || 0) : 0;
    return Math.max(base - desc, 0);
  });

  // ── Paso 5: Contrato ───────────────────────────────────────
  readonly checkTerminos = model(false);
  readonly checkDatos = model(false);
  readonly checkReglamento = model(false);
  readonly firmaNombre = model('');
  readonly contratoFirmado = signal(false);
  readonly firmaTimestamp = signal('');

  readonly puedeFiremar = computed(
    () => this.checkTerminos() && this.checkDatos() && this.checkReglamento()
      && this.firmaNombre().trim().length >= 5
      && !this.contratoFirmado(),
  );

  // ── Paso 6: Confirmación ───────────────────────────────────
  readonly matriculaNumero = `2026-${String(Math.floor(Math.random() * 1000) + 200).padStart(4, '0')}`;

  readonly nombreCompleto = computed(
    () => [this.nombres(), this.apellidos()].filter(Boolean).join(' ') || 'Alumno',
  );

  ngOnInit(): void {
    this.setupDrawerActions();
  }

  ngOnDestroy(): void {
    this.layoutDrawer.setActions([]);
  }

  private setupDrawerActions(): void {
    this.layoutDrawer.setActions([
      {
        label: 'Ayuda',
        icon: 'help-circle',
        callback: () => {
          console.log('Mostrar ayuda contextual');
        }
      },
      {
        label: 'Reiniciar',
        icon: 'rotate-ccw',
        callback: () => {
          this.activeStep.set(0);
        }
      }
    ]);
  }

  // ── Acciones ───────────────────────────────────────────────
  nextStep(): void {
    const current = this.activeStep();
    if (current < 5) this.activeStep.set(current + 1);
  }

  prevStep(): void {
    const current = this.activeStep();
    if (current > 0) this.activeStep.set(current - 1);
  }

  goToStep(step: number | undefined): void {
    if (step == null) return;
    if (step <= this.activeStep()) {
      this.activeStep.set(step);
    }
  }

  selectCategoria(cat: 'no-profesional' | 'profesional' | 'singular'): void {
    this.categoriaCurso.set(cat);
    const cursos = this.cursosDisponibles();
    if (cursos.length > 0) {
      this.tipoCurso.set(cursos[0].value);
    }
  }

  selectCurso(value: string): void {
    this.tipoCurso.set(value);
  }

  /** Mapea el valor del curso a su ícono Lucide */
  cursoIcon(value: string): string {
    const icons: Record<string, string> = {
      clase_b: 'car',
      clase_b_sence: 'award',
      profesional_a2: 'truck',
      profesional_a3: 'truck',
      profesional_a4: 'truck',
      profesional_a5: 'truck',
      singular: 'star',
    };
    return icons[value] ?? 'car';
  }

  selectMetodoPago(value: string): void {
    this.metodoPago.set(value);
  }

  onFotoFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.fotoPreviewUrl.set(e.target?.result as string);
      this.fotoSubida.set(true);
    };
    reader.readAsDataURL(file);
  }

  resetFoto(): void {
    this.fotoSubida.set(false);
    this.fotoPreviewUrl.set(null);
  }

  onDocumentFileChange(field: 'autorizacion' | 'hojaVida' | 'cedula' | 'licencia' | 'certMedico' | 'examPsicologico' | 'certSemep', event: Event): void {
    const input = event.target as HTMLInputElement;
    const hasFile = (input?.files?.length ?? 0) > 0;
    switch (field) {
      case 'autorizacion': this.autorizacionSubida.set(hasFile); break;
      case 'hojaVida': this.hojaVidaSubida.set(hasFile); break;
      case 'cedula': this.cedulaSubida.set(hasFile); break;
      case 'licencia': this.licenciaSubida.set(hasFile); break;
      case 'certMedico': this.certMedicoSubido.set(hasFile); break;
      case 'examPsicologico': this.examPsicologicoSubido.set(hasFile); break;
      case 'certSemep': this.certSemepSubido.set(hasFile); break;
    }
  }

  firmarContrato(): void {
    if (!this.puedeFiremar()) return;
    const now = new Date();
    const ts = now.toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'medium' });
    this.firmaTimestamp.set(`Firmado por "${this.firmaNombre().trim()}" el ${ts}`);
    this.contratoFirmado.set(true);
  }

  formatCLP(value: number): string {
    return '$' + value.toLocaleString('es-CL');
  }

  get metodoPagoLabel(): string {
    const labels: Record<string, string> = {
      efectivo: 'Efectivo',
      transferencia: 'Transferencia Bancaria',
      tarjeta: 'Débito/Crédito',
      pendiente: 'Pago pendiente',
    };
    return labels[this.metodoPago()] ?? this.metodoPago();
  }
}
