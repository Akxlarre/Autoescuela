import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { guestGuard } from '@core/guards/guest.guard';

/**
 * Rutas de la aplicación, estructuradas por portal de rol.
 *
 *   /           → rutas públicas (login)
 *   /app        → redirect a /app/admin/dashboard
 *   /app/admin  → portal Administrador
 *   /app/secretaria → portal Secretaria
 *   /app/instructor → portal Instructor
 *   /app/alumno     → portal Alumno
 *   /app/relator    → portal Relator
 */
export const routes: Routes = [
  // Rutas públicas — autenticación
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },

  // Rutas protegidas — envueltas en el layout AppShell
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      // Redirect raíz → admin dashboard
      { path: '', redirectTo: 'admin/dashboard', pathMatch: 'full' },

      // ─────────────────────────────────────
      // ADMIN
      // ─────────────────────────────────────
      {
        path: 'admin/dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'admin/alumnos',
        loadComponent: () =>
          import('./features/admin/alumnos/admin-alumnos.component').then(
            (m) => m.AdminAlumnosComponent,
          ),
      },
      {
        path: 'admin/agenda',
        loadComponent: () =>
          import('./features/admin/agenda/admin-agenda.component').then(
            (m) => m.AdminAgendaComponent,
          ),
      },
      {
        path: 'admin/asistencia',
        loadComponent: () =>
          import('./features/admin/asistencia/admin-asistencia.component').then(
            (m) => m.AdminAsistenciaComponent,
          ),
      },
      {
        path: 'admin/matricula',
        loadComponent: () =>
          import('./features/admin/matricula/admin-matricula.component').then(
            (m) => m.AdminMatriculaComponent,
          ),
      },
      {
        path: 'admin/pagos',
        loadComponent: () =>
          import('./features/admin/pagos/admin-pagos.component').then((m) => m.AdminPagosComponent),
      },
      {
        path: 'admin/contabilidad/reportes',
        loadComponent: () =>
          import('./features/admin/contabilidad-reportes/admin-contabilidad-reportes.component').then(
            (m) => m.AdminContabilidadReportesComponent,
          ),
      },
      {
        path: 'admin/contabilidad/cuadratura',
        loadComponent: () =>
          import('./features/admin/contabilidad-cuadratura/admin-contabilidad-cuadratura.component').then(
            (m) => m.AdminContabilidadCuadraturaComponent,
          ),
      },
      {
        path: 'admin/contabilidad/anticipos',
        loadComponent: () =>
          import('./features/admin/contabilidad-anticipos/admin-contabilidad-anticipos.component').then(
            (m) => m.AdminContabilidadAnticiposComponent,
          ),
      },
      {
        path: 'admin/contabilidad/cursos',
        loadComponent: () =>
          import('./features/admin/contabilidad-cursos/admin-contabilidad-cursos.component').then(
            (m) => m.AdminContabilidadCursosComponent,
          ),
      },
      {
        path: 'admin/flota',
        loadComponent: () =>
          import('./features/admin/flota/admin-flota.component').then((m) => m.AdminFlotaComponent),
      },
      {
        path: 'admin/instructores',
        loadComponent: () =>
          import('./features/admin/instructores/admin-instructores.component').then(
            (m) => m.AdminInstructoresComponent,
          ),
      },
      {
        path: 'admin/certificacion',
        loadComponent: () =>
          import('./features/admin/certificacion/admin-certificacion.component').then(
            (m) => m.AdminCertificacionComponent,
          ),
      },
      {
        path: 'admin/documentos',
        loadComponent: () =>
          import('./features/admin/documentos/admin-documentos.component').then(
            (m) => m.AdminDocumentosComponent,
          ),
      },
      {
        path: 'admin/usuarios',
        loadComponent: () =>
          import('./features/admin/usuarios/admin-usuarios.component').then(
            (m) => m.AdminUsuariosComponent,
          ),
      },
      {
        path: 'admin/secretarias',
        loadComponent: () =>
          import('./features/admin/secretarias/admin-secretarias.component').then(
            (m) => m.AdminSecretariasComponent,
          ),
      },
      {
        path: 'admin/tareas',
        loadComponent: () =>
          import('./features/admin/tareas/admin-tareas.component').then(
            (m) => m.AdminTareasComponent,
          ),
      },
      {
        path: 'admin/libro-de-clases',
        loadComponent: () =>
          import('./features/admin/libro-de-clases/admin-libro-de-clases.component').then(
            (m) => m.AdminLibroDeClasesComponent,
          ),
      },
      {
        path: 'admin/psicotecnico',
        loadComponent: () =>
          import('./features/admin/psicotecnico/admin-psicotecnico.component').then(
            (m) => m.AdminPsicotecnicoComponent,
          ),
      },
      {
        path: 'admin/clase-profesional/relatores',
        loadComponent: () =>
          import('./features/admin/profesional-relatores/admin-profesional-relatores.component').then(
            (m) => m.AdminProfesionalRelatoresComponent,
          ),
      },
      {
        path: 'admin/clase-profesional/promociones',
        loadComponent: () =>
          import('./features/admin/profesional-promociones/admin-profesional-promociones.component').then(
            (m) => m.AdminProfesionalPromocionesComponent,
          ),
      },
      {
        path: 'admin/clase-profesional/certificados',
        loadComponent: () =>
          import('./features/admin/profesional-certificados/admin-profesional-certificados.component').then(
            (m) => m.AdminProfesionalCertificadosComponent,
          ),
      },
      {
        path: 'admin/clase-profesional/archivo',
        loadComponent: () =>
          import('./features/admin/profesional-archivo/admin-profesional-archivo.component').then(
            (m) => m.AdminProfesionalArchivoComponent,
          ),
      },
      {
        path: 'admin/auditoria',
        loadComponent: () =>
          import('./features/admin/auditoria/admin-auditoria.component').then(
            (m) => m.AdminAuditoriaComponent,
          ),
      },
      {
        path: 'admin/notificaciones',
        loadComponent: () =>
          import('./features/admin/notificaciones/admin-notificaciones.component').then(
            (m) => m.AdminNotificacionesComponent,
          ),
      },

      // ─────────────────────────────────────
      // SECRETARIA
      // ─────────────────────────────────────
      {
        path: 'secretaria/dashboard',
        loadComponent: () =>
          import('./features/secretaria/dashboard/secretaria-dashboard.component').then(
            (m) => m.SecretariaDashboardComponent,
          ),
      },
      {
        path: 'secretaria/alumnos',
        loadComponent: () =>
          import('./features/secretaria/alumnos/secretaria-alumnos.component').then(
            (m) => m.SecretariaAlumnosComponent,
          ),
      },
      {
        path: 'secretaria/agenda',
        loadComponent: () =>
          import('./features/secretaria/agenda/secretaria-agenda.component').then(
            (m) => m.SecretariaAgendaComponent,
          ),
      },
      {
        path: 'secretaria/asistencia',
        loadComponent: () =>
          import('./features/secretaria/asistencia/secretaria-asistencia.component').then(
            (m) => m.SecretariaAsistenciaComponent,
          ),
      },
      {
        path: 'secretaria/matricula',
        loadComponent: () =>
          import('./features/secretaria/matricula/secretaria-matricula.component').then(
            (m) => m.SecretariaMatriculaComponent,
          ),
      },
      {
        path: 'secretaria/pagos',
        loadComponent: () =>
          import('./features/secretaria/pagos/secretaria-pagos.component').then(
            (m) => m.SecretariaPagosComponent,
          ),
      },
      {
        path: 'secretaria/contabilidad/cuadratura',
        loadComponent: () =>
          import('./features/secretaria/contabilidad-cuadratura/secretaria-contabilidad-cuadratura.component').then(
            (m) => m.SecretariaContabilidadCuadraturaComponent,
          ),
      },
      {
        path: 'secretaria/contabilidad/reportes',
        loadComponent: () =>
          import('./features/secretaria/contabilidad-reportes/secretaria-contabilidad-reportes.component').then(
            (m) => m.SecretariaContabilidadReportesComponent,
          ),
      },
      {
        path: 'secretaria/certificados',
        loadComponent: () =>
          import('./features/secretaria/certificados/secretaria-certificados.component').then(
            (m) => m.SecretariaCertificadosComponent,
          ),
      },
      {
        path: 'secretaria/documentos',
        loadComponent: () =>
          import('./features/secretaria/documentos/secretaria-documentos.component').then(
            (m) => m.SecretariaDocumentosComponent,
          ),
      },
      {
        path: 'secretaria/instructores',
        loadComponent: () =>
          import('./features/secretaria/instructores/secretaria-instructores.component').then(
            (m) => m.SecretariaInstructoresComponent,
          ),
      },
      {
        path: 'secretaria/comunicaciones',
        loadComponent: () =>
          import('./features/secretaria/comunicaciones/secretaria-comunicaciones.component').then(
            (m) => m.SecretariaComunicacionesComponent,
          ),
      },
      {
        path: 'secretaria/observaciones',
        loadComponent: () =>
          import('./features/secretaria/observaciones/secretaria-observaciones.component').then(
            (m) => m.SecretariaObservacionesComponent,
          ),
      },
      {
        path: 'secretaria/psicotecnico',
        loadComponent: () =>
          import('./features/secretaria/psicotecnico/secretaria-psicotecnico.component').then(
            (m) => m.SecretariaPsicotecnicoComponent,
          ),
      },
      {
        path: 'secretaria/profesional/relatores',
        loadComponent: () =>
          import('./features/secretaria/profesional-relatores/secretaria-profesional-relatores.component').then(
            (m) => m.SecretariaProfesionalRelatoresComponent,
          ),
      },
      {
        path: 'secretaria/profesional/promociones',
        loadComponent: () =>
          import('./features/secretaria/profesional-promociones/secretaria-profesional-promociones.component').then(
            (m) => m.SecretariaProfesionalPromocionesComponent,
          ),
      },
      {
        path: 'secretaria/profesional/notas',
        loadComponent: () =>
          import('./features/secretaria/profesional-notas/secretaria-profesional-notas.component').then(
            (m) => m.SecretariaProfesionalNotasComponent,
          ),
      },
      {
        path: 'secretaria/profesional/certificados',
        loadComponent: () =>
          import('./features/secretaria/profesional-certificados/secretaria-profesional-certificados.component').then(
            (m) => m.SecretariaProfesionalCertificadosComponent,
          ),
      },
      {
        path: 'secretaria/profesional/archivo',
        loadComponent: () =>
          import('./features/secretaria/profesional-archivo/secretaria-profesional-archivo.component').then(
            (m) => m.SecretariaProfesionalArchivoComponent,
          ),
      },
      {
        path: 'secretaria/notificaciones',
        loadComponent: () =>
          import('./features/secretaria/notificaciones/secretaria-notificaciones.component').then(
            (m) => m.SecretariaNotificacionesComponent,
          ),
      },
      {
        path: 'secretaria/ex-alumnos',
        loadComponent: () =>
          import('./features/secretaria/ex-alumnos/secretaria-ex-alumnos.component').then(
            (m) => m.SecretariaExAlumnosComponent,
          ),
      },
      {
        path: 'secretaria/servicios-especiales',
        loadComponent: () =>
          import('./features/secretaria/servicios-especiales/secretaria-servicios-especiales.component').then(
            (m) => m.SecretariaServiciosEspecialesComponent,
          ),
      },
      {
        path: 'secretaria/libro-de-clases',
        loadComponent: () =>
          import('./features/secretaria/libro-de-clases/secretaria-libro-de-clases.component').then(
            (m) => m.SecretariaLibroDeClasesComponent,
          ),
      },

      // ─────────────────────────────────────
      // INSTRUCTOR
      // ─────────────────────────────────────
      {
        path: 'instructor/dashboard',
        loadComponent: () =>
          import('./features/instructor/dashboard/instructor-dashboard.component').then(
            (m) => m.InstructorDashboardComponent,
          ),
      },
      {
        path: 'instructor/alumnos',
        loadComponent: () =>
          import('./features/instructor/alumnos/instructor-alumnos.component').then(
            (m) => m.InstructorAlumnosComponent,
          ),
      },
      {
        path: 'instructor/clase/iniciar',
        loadComponent: () =>
          import('./features/instructor/clase/instructor-clase.component').then(
            (m) => m.InstructorClaseComponent,
          ),
      },
      {
        path: 'instructor/horario',
        loadComponent: () =>
          import('./features/instructor/horario/instructor-horario.component').then(
            (m) => m.InstructorHorarioComponent,
          ),
      },
      {
        path: 'instructor/ensayos-teoricos',
        loadComponent: () =>
          import('./features/instructor/ensayos-teoricos/instructor-ensayos-teoricos.component').then(
            (m) => m.InstructorEnsayosTeoricoComponent,
          ),
      },
      {
        path: 'instructor/liquidacion',
        loadComponent: () =>
          import('./features/instructor/liquidacion/instructor-liquidacion.component').then(
            (m) => m.InstructorLiquidacionComponent,
          ),
      },
      {
        path: 'instructor/notificaciones',
        loadComponent: () =>
          import('./features/instructor/notificaciones/instructor-notificaciones.component').then(
            (m) => m.InstructorNotificacionesComponent,
          ),
      },
      {
        path: 'instructor/asistencia',
        loadComponent: () =>
          import('./features/instructor/asistencia/instructor-asistencia.component').then(
            (m) => m.InstructorAsistenciaComponent,
          ),
      },
      {
        path: 'instructor/ayuda',
        loadComponent: () =>
          import('./features/instructor/ayuda/instructor-ayuda.component').then(
            (m) => m.InstructorAyudaComponent,
          ),
      },

      // ─────────────────────────────────────
      // ALUMNO
      // ─────────────────────────────────────
      {
        path: 'alumno/dashboard',
        loadComponent: () =>
          import('./features/alumno/dashboard/alumno-dashboard.component').then(
            (m) => m.AlumnoDashboardComponent,
          ),
      },
      {
        path: 'alumno/clases',
        loadComponent: () =>
          import('./features/alumno/clases/alumno-clases.component').then(
            (m) => m.AlumnoClasesComponent,
          ),
      },
      {
        path: 'alumno/agendar',
        loadComponent: () =>
          import('./features/alumno/agendar/alumno-agendar.component').then(
            (m) => m.AlumnoAgendarComponent,
          ),
      },
      {
        path: 'alumno/notas',
        loadComponent: () =>
          import('./features/alumno/notas/alumno-notas.component').then(
            (m) => m.AlumnoNotasComponent,
          ),
      },
      {
        path: 'alumno/certificado',
        loadComponent: () =>
          import('./features/alumno/certificado/alumno-certificado.component').then(
            (m) => m.AlumnoCertificadoComponent,
          ),
      },
      {
        path: 'alumno/pagos',
        loadComponent: () =>
          import('./features/alumno/pagos/alumno-pagos.component').then(
            (m) => m.AlumnoPagosComponent,
          ),
      },
      {
        path: 'alumno/notificaciones',
        loadComponent: () =>
          import('./features/alumno/notificaciones/alumno-notificaciones.component').then(
            (m) => m.AlumnoNotificacionesComponent,
          ),
      },
      {
        path: 'alumno/asistencia',
        loadComponent: () =>
          import('./features/alumno/asistencia/alumno-asistencia.component').then(
            (m) => m.AlumnoAsistenciaComponent,
          ),
      },
      {
        path: 'alumno/horario',
        loadComponent: () =>
          import('./features/alumno/horario/alumno-horario.component').then(
            (m) => m.AlumnoHorarioComponent,
          ),
      },
      {
        path: 'alumno/progreso',
        loadComponent: () =>
          import('./features/alumno/progreso/alumno-progreso.component').then(
            (m) => m.AlumnoProgresoComponent,
          ),
      },
      {
        path: 'alumno/pruebas-online',
        loadComponent: () =>
          import('./features/alumno/pruebas-online/alumno-pruebas-online.component').then(
            (m) => m.AlumnoPruebasOnlineComponent,
          ),
      },
      {
        path: 'alumno/ayuda',
        loadComponent: () =>
          import('./features/alumno/ayuda/alumno-ayuda.component').then(
            (m) => m.AlumnoAyudaComponent,
          ),
      },

      // ─────────────────────────────────────
      // RELATOR
      // ─────────────────────────────────────
      {
        path: 'relator/dashboard',
        loadComponent: () =>
          import('./features/relator/dashboard/relator-dashboard.component').then(
            (m) => m.RelatorDashboardComponent,
          ),
      },
      {
        path: 'relator/alumnos',
        loadComponent: () =>
          import('./features/relator/alumnos/relator-alumnos.component').then(
            (m) => m.RelatorAlumnosComponent,
          ),
      },
      {
        path: 'relator/asistencia',
        loadComponent: () =>
          import('./features/relator/asistencia/relator-asistencia.component').then(
            (m) => m.RelatorAsistenciaComponent,
          ),
      },
      {
        path: 'relator/notas',
        loadComponent: () =>
          import('./features/relator/notas/relator-notas.component').then(
            (m) => m.RelatorNotasComponent,
          ),
      },
      {
        path: 'relator/maquinaria',
        loadComponent: () =>
          import('./features/relator/maquinaria/relator-maquinaria.component').then(
            (m) => m.RelatorMaquinariaComponent,
          ),
      },
      {
        path: 'relator/acta-final',
        loadComponent: () =>
          import('./features/relator/acta-final/relator-acta-final.component').then(
            (m) => m.RelatorActaFinalComponent,
          ),
      },
    ],
  },

  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
