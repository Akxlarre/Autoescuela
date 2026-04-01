import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { firstLoginGuard } from '@core/guards/first-login.guard';
import { guestGuard } from '@core/guards/guest.guard';
import { hasRoleGuard } from '@core/guards/role.guard';
import { roleRedirectGuard } from '@core/guards/role-redirect.guard';
import { enrollmentDraftGuard } from '@core/guards/enrollment-draft.guard';

/**
 * Rutas de la aplicación, estructuradas por portal de rol.
 *
 *   /           → rutas públicas (login)
 *   /app        → redirect dinámico según rol
 *   /app/admin  → portal Administrador
 *   /app/secretaria → portal Secretaria
 *   /app/instructor → portal Instructor
 *   /app/alumno     → portal Alumno
 *   /app/relator    → portal Relator
 *
 * Cada grupo de rol usa `path: '<rol>'` como prefijo para que
 * el router de Angular solo ejecute el guard del rol correcto.
 * NUNCA usar `path: ''` como wrapper de grupo — causa que el router
 * ejecute guards de TODOS los grupos en orden, provocando redirect loops.
 */
export const routes: Routes = [
  // Rutas de autenticación — sin AppShell (pantalla limpia, igual que login)
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'force-password-change',
    canActivate: [firstLoginGuard],
    loadComponent: () =>
      import('./features/auth/force-password-change/force-password-change.component').then(
        (m) => m.ForcePasswordChangeComponent,
      ),
  },
  {
    path: 'recuperar-contrasena',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/recuperar-contrasena/recuperar-contrasena.component').then(
        (m) => m.RecuperarContrasenaComponent,
      ),
  },
  {
    path: 'acceso-denegado',
    loadComponent: () =>
      import('./features/acceso-denegado/acceso-denegado.component').then(
        (m) => m.AccesoDenegadoComponent,
      ),
  },

  // Matrícula pública — sin autenticación, sin AppShell
  {
    path: 'inscripcion',
    loadComponent: () =>
      import('./features/public-enrollment/public-enrollment.component').then(
        (m) => m.PublicEnrollmentComponent,
      ),
  },
  {
    path: 'inscripcion/retorno',
    loadComponent: () =>
      import('./features/public-enrollment/retorno/public-enrollment-retorno.component').then(
        (m) => m.PublicEnrollmentRetornoComponent,
      ),
  },

  // Rutas protegidas — envueltas en el layout AppShell
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      // Redirect raíz → portal dinámico según rol
      { path: '', pathMatch: 'full', canActivate: [roleRedirectGuard], children: [] },

      // ─────────────────────────────────────
      // ADMIN
      // ─────────────────────────────────────
      {
        path: 'admin',
        canActivate: [hasRoleGuard(['admin'])],
        children: [
          {
            path: 'dashboard',
            loadComponent: () =>
              import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
          },
          {
            path: 'alumnos',
            loadComponent: () =>
              import('./features/admin/alumnos/admin-alumnos.component').then(
                (m) => m.AdminAlumnosComponent,
              ),
          },
          {
            path: 'alumnos/:id',
            loadComponent: () =>
              import('./features/admin/alumno-detalle/admin-alumno-detalle.component').then(
                (m) => m.AdminAlumnoDetalleComponent,
              ),
          },
          {
            path: 'ex-alumnos',
            loadComponent: () =>
              import('./features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component').then(
                (m) => m.AdminExAlumnosComponent,
              ),
          },
          {
            path: 'agenda',
            loadComponent: () =>
              import('./features/admin/agenda/admin-agenda.component').then(
                (m) => m.AdminAgendaComponent,
              ),
          },
          {
            path: 'asistencia',
            loadComponent: () =>
              import('./features/admin/asistencia/admin-asistencia.component').then(
                (m) => m.AdminAsistenciaComponent,
              ),
          },
          {
            path: 'matricula',
            loadComponent: () =>
              import('./features/admin/matricula/admin-matricula.component').then(
                (m) => m.AdminMatriculaComponent,
              ),
            canDeactivate: [enrollmentDraftGuard],
          },
          {
            path: 'pagos',
            loadComponent: () =>
              import('./features/admin/pagos/admin-pagos.component').then(
                (m) => m.AdminPagosComponent,
              ),
          },
          {
            path: 'contabilidad/reportes',
            loadComponent: () =>
              import('./features/admin/contabilidad-reportes/admin-contabilidad-reportes.component').then(
                (m) => m.AdminContabilidadReportesComponent,
              ),
          },
          {
            path: 'contabilidad/cuadratura',
            loadComponent: () =>
              import('./features/admin/contabilidad-cuadratura/admin-contabilidad-cuadratura.component').then(
                (m) => m.AdminContabilidadCuadraturaComponent,
              ),
          },
          {
            path: 'contabilidad/anticipos',
            loadComponent: () =>
              import('./features/admin/contabilidad-anticipos/admin-contabilidad-anticipos.component').then(
                (m) => m.AdminContabilidadAnticiposComponent,
              ),
          },
          {
            path: 'contabilidad/cursos',
            loadComponent: () =>
              import('./features/admin/contabilidad-cursos/admin-contabilidad-cursos.component').then(
                (m) => m.AdminContabilidadCursosComponent,
              ),
          },
          {
            path: 'flota',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import('./features/admin/flota/admin-flota.component').then(
                    (m) => m.AdminFlotaComponent,
                  ),
              },
              {
                path: 'hoja-de-ruta/:id',
                loadComponent: () =>
                  import('./features/admin/flota/route-sheet/route-sheet.component').then(
                    (m) => m.RouteSheetComponent,
                  ),
              },
              {
                path: ':id/mantenimientos',
                loadComponent: () =>
                  import('./features/admin/flota/vehicle-maintenances/vehicle-maintenances.component').then(
                    (m) => m.VehicleMaintenancesComponent,
                  ),
              },
            ],
          },
          {
            path: 'instructores',
            loadComponent: () =>
              import('./features/admin/instructores/admin-instructores.component').then(
                (m) => m.AdminInstructoresComponent,
              ),
          },
          {
            path: 'certificacion',
            loadComponent: () =>
              import('./features/admin/certificacion/admin-certificacion.component').then(
                (m) => m.AdminCertificacionComponent,
              ),
          },
          {
            path: 'documentos',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import('./features/admin/documentos/admin-documentos.component').then(
                    (m) => m.AdminDocumentosComponent,
                  ),
              },
              {
                path: 'alumnos/:id',
                loadComponent: () =>
                  import('./features/admin/documentos/alumno-docs-detalle/admin-alumno-docs-detalle.component').then(
                    (m) => m.AdminAlumnoDocsDetalleComponent,
                  ),
              },
            ],
          },
          {
            path: 'usuarios',
            loadComponent: () =>
              import('./features/admin/usuarios/admin-usuarios.component').then(
                (m) => m.AdminUsuariosComponent,
              ),
          },
          {
            path: 'secretarias',
            loadComponent: () =>
              import('./features/admin/secretarias/admin-secretarias.component').then(
                (m) => m.AdminSecretariasComponent,
              ),
          },
          {
            path: 'tareas',
            loadComponent: () =>
              import('./features/admin/tareas/admin-tareas.component').then(
                (m) => m.AdminTareasComponent,
              ),
          },
          {
            path: 'libro-de-clases',
            loadComponent: () =>
              import('./features/admin/libro-de-clases/admin-libro-de-clases.component').then(
                (m) => m.AdminLibroDeClasesComponent,
              ),
          },
          {
            path: 'servicios-especiales',
            loadComponent: () =>
              import('./features/admin/servicios-especiales/admin-servicios-especiales.component').then(
                (m) => m.AdminServiciosEspecialesComponent,
              ),
          },
          {
            path: 'notificaciones',
            loadComponent: () =>
              import('./features/admin/notificaciones/admin-notificaciones.component').then(
                (m) => m.AdminNotificacionesComponent,
              ),
          },
          {
            path: 'clase-profesional/relatores',
            loadComponent: () =>
              import('./features/admin/profesional-relatores/admin-profesional-relatores.component').then(
                (m) => m.AdminProfesionalRelatoresComponent,
              ),
          },
          {
            path: 'clase-profesional/promociones',
            loadComponent: () =>
              import('./features/admin/profesional-promociones/admin-profesional-promociones.component').then(
                (m) => m.AdminProfesionalPromocionesComponent,
              ),
          },
          {
            path: 'clase-profesional/asistencia',
            loadComponent: () =>
              import('./features/admin/profesional-asistencia/admin-profesional-asistencia.component').then(
                (m) => m.AdminProfesionalAsistenciaComponent,
              ),
          },
          {
            path: 'clase-profesional/certificados',
            loadComponent: () =>
              import('./features/admin/profesional-certificados/admin-profesional-certificados.component').then(
                (m) => m.AdminProfesionalCertificadosComponent,
              ),
          },
          {
            path: 'clase-profesional/archivo',
            loadComponent: () =>
              import('./features/admin/profesional-archivo/admin-profesional-archivo.component').then(
                (m) => m.AdminProfesionalArchivoComponent,
              ),
          },
          {
            path: 'auditoria',
            loadComponent: () =>
              import('./features/admin/auditoria/admin-auditoria.component').then(
                (m) => m.AdminAuditoriaComponent,
              ),
          },
        ],
      },

      // ─────────────────────────────────────
      // SECRETARIA
      // ─────────────────────────────────────
      {
        path: 'secretaria',
        canActivate: [hasRoleGuard(['secretaria'])],
        children: [
          {
            path: 'dashboard',
            loadComponent: () =>
              import('./features/secretaria/dashboard/secretaria-dashboard.component').then(
                (m) => m.SecretariaDashboardComponent,
              ),
          },
          {
            path: 'alumnos',
            loadComponent: () =>
              import('./features/secretaria/alumnos/secretaria-alumnos.component').then(
                (m) => m.SecretariaAlumnosComponent,
              ),
          },
          {
            path: 'alumnos/pre-inscritos',
            loadComponent: () =>
              import('./features/secretaria/alumnos-pre-inscritos/secretaria-alumnos-pre-inscritos.component').then(
                (m) => m.SecretariaAlumnosPreInscritosComponent,
              ),
          },
          {
            path: 'agenda',
            loadComponent: () =>
              import('./features/secretaria/agenda/secretaria-agenda.component').then(
                (m) => m.SecretariaAgendaComponent,
              ),
          },
          {
            path: 'asistencia',
            loadComponent: () =>
              import('./features/secretaria/asistencia/secretaria-asistencia.component').then(
                (m) => m.SecretariaAsistenciaComponent,
              ),
          },
          {
            path: 'asistencia/matriz',
            loadComponent: () =>
              import('./features/secretaria/asistencia-matriz/secretaria-asistencia-matriz.component').then(
                (m) => m.SecretariaAsistenciaMatrizComponent,
              ),
          },
          {
            path: 'asistencia/profesional',
            loadComponent: () =>
              import('./features/secretaria/asistencia-profesional/secretaria-asistencia-profesional.component').then(
                (m) => m.SecretariaAsistenciaProfesionalComponent,
              ),
          },
          {
            path: 'matricula',
            loadComponent: () =>
              import('./features/secretaria/matricula/secretaria-matricula.component').then(
                (m) => m.SecretariaMatriculaComponent,
              ),
            canDeactivate: [enrollmentDraftGuard],
          },
          {
            path: 'pagos',
            loadComponent: () =>
              import('./features/secretaria/pagos/secretaria-pagos.component').then(
                (m) => m.SecretariaPagosComponent,
              ),
          },
          {
            path: 'contabilidad/cuadratura',
            loadComponent: () =>
              import('./features/secretaria/contabilidad-cuadratura/secretaria-contabilidad-cuadratura.component').then(
                (m) => m.SecretariaContabilidadCuadraturaComponent,
              ),
          },
          {
            path: 'contabilidad/reportes',
            loadComponent: () =>
              import('./features/secretaria/contabilidad-reportes/secretaria-contabilidad-reportes.component').then(
                (m) => m.SecretariaContabilidadReportesComponent,
              ),
          },
          {
            path: 'certificados',
            loadComponent: () =>
              import('./features/secretaria/certificados/secretaria-certificados.component').then(
                (m) => m.SecretariaCertificadosComponent,
              ),
          },
          {
            path: 'documentos',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import('./features/secretaria/documentos/secretaria-documentos.component').then(
                    (m) => m.SecretariaDocumentosComponent,
                  ),
              },
              {
                path: 'alumnos/:id',
                loadComponent: () =>
                  import('./features/admin/documentos/alumno-docs-detalle/admin-alumno-docs-detalle.component').then(
                    (m) => m.AdminAlumnoDocsDetalleComponent,
                  ),
              },
            ],
          },
          {
            path: 'instructores',
            loadComponent: () =>
              import('./features/secretaria/instructores/secretaria-instructores.component').then(
                (m) => m.SecretariaInstructoresComponent,
              ),
          },
          {
            path: 'comunicaciones',
            loadComponent: () =>
              import('./features/secretaria/comunicaciones/secretaria-comunicaciones.component').then(
                (m) => m.SecretariaComunicacionesComponent,
              ),
          },
          {
            path: 'observaciones',
            loadComponent: () =>
              import('./features/secretaria/observaciones/secretaria-observaciones.component').then(
                (m) => m.SecretariaObservacionesComponent,
              ),
          },

          {
            path: 'profesional/relatores',
            loadComponent: () =>
              import('./features/secretaria/profesional-relatores/secretaria-profesional-relatores.component').then(
                (m) => m.SecretariaProfesionalRelatoresComponent,
              ),
          },
          {
            path: 'profesional/promociones',
            loadComponent: () =>
              import('./features/secretaria/profesional-promociones/secretaria-profesional-promociones.component').then(
                (m) => m.SecretariaProfesionalPromocionesComponent,
              ),
          },
          {
            path: 'profesional/asistencia',
            loadComponent: () =>
              import('./features/secretaria/profesional-asistencia/secretaria-profesional-asistencia.component').then(
                (m) => m.SecretariaProfesionalAsistenciaComponent,
              ),
          },
          {
            path: 'profesional/notas',
            loadComponent: () =>
              import('./features/secretaria/profesional-notas/secretaria-profesional-notas.component').then(
                (m) => m.SecretariaProfesionalNotasComponent,
              ),
          },
          {
            path: 'profesional/certificados',
            loadComponent: () =>
              import('./features/secretaria/profesional-certificados/secretaria-profesional-certificados.component').then(
                (m) => m.SecretariaProfesionalCertificadosComponent,
              ),
          },
          {
            path: 'profesional/archivo',
            loadComponent: () =>
              import('./features/secretaria/profesional-archivo/secretaria-profesional-archivo.component').then(
                (m) => m.SecretariaProfesionalArchivoComponent,
              ),
          },
          {
            path: 'notificaciones',
            loadComponent: () =>
              import('./features/secretaria/notificaciones/secretaria-notificaciones.component').then(
                (m) => m.SecretariaNotificacionesComponent,
              ),
          },
          {
            path: 'ex-alumnos',
            loadComponent: () =>
              import('./features/secretaria/ex-alumnos/secretaria-ex-alumnos.component').then(
                (m) => m.SecretariaExAlumnosComponent,
              ),
          },
          {
            path: 'servicios-especiales',
            loadComponent: () =>
              import('./features/secretaria/servicios-especiales/secretaria-servicios-especiales.component').then(
                (m) => m.SecretariaServiciosEspecialesComponent,
              ),
          },
          {
            path: 'libro-de-clases',
            loadComponent: () =>
              import('./features/secretaria/libro-de-clases/secretaria-libro-de-clases.component').then(
                (m) => m.SecretariaLibroDeClasesComponent,
              ),
          },
        ],
      },

      // ─────────────────────────────────────
      // INSTRUCTOR
      // ─────────────────────────────────────
      {
        path: 'instructor',
        canActivate: [hasRoleGuard(['instructor'])],
        children: [
          {
            path: 'dashboard',
            loadComponent: () =>
              import('./features/instructor/dashboard/instructor-dashboard.component').then(
                (m) => m.InstructorDashboardComponent,
              ),
          },
          {
            path: 'alumnos',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import('./features/instructor/alumnos/instructor-alumnos.component').then(
                    (m) => m.InstructorAlumnosComponent,
                  ),
              },
              {
                path: ':id',
                redirectTo: ':id/ficha',
                pathMatch: 'full',
              },
              {
                path: ':id/ficha',
                loadComponent: () =>
                  import('./features/instructor/ficha/instructor-ficha.component').then(
                    (m) => m.InstructorFichaComponent,
                  ),
              },
              {
                path: ':id/evaluacion/:sessionId',
                loadComponent: () =>
                  import('./features/instructor/evaluacion/instructor-evaluacion.component').then(
                    (m) => m.InstructorEvaluacionComponent,
                  ),
              },
            ],
          },
          {
            path: 'clase/iniciar',
            loadComponent: () =>
              import('./features/instructor/clase/instructor-clase.component').then(
                (m) => m.InstructorClaseComponent,
              ),
          },
          {
            path: 'clase/:id',
            loadComponent: () =>
              import('./features/instructor/clase-detail/instructor-clase-detail.component').then(
                (m) => m.InstructorClaseDetailComponent,
              ),
          },
          {
            path: 'ficha/:id',
            redirectTo: 'alumnos/:id/ficha',
            pathMatch: 'full',
          },
          {
            path: 'horario',
            loadComponent: () =>
              import('./features/instructor/horario/instructor-horario.component').then(
                (m) => m.InstructorHorarioComponent,
              ),
          },
          {
            path: 'ensayos-teoricos',
            loadComponent: () =>
              import('./features/instructor/ensayos-teoricos/instructor-ensayos-teoricos.component').then(
                (m) => m.InstructorEnsayosTeoricosComponent,
              ),
          },
          {
            path: 'liquidacion',
            loadComponent: () =>
              import('./features/instructor/liquidacion/instructor-liquidacion.component').then(
                (m) => m.InstructorLiquidacionComponent,
              ),
          },
          {
            path: 'notificaciones',
            loadComponent: () =>
              import('./features/instructor/notificaciones/instructor-notificaciones.component').then(
                (m) => m.InstructorNotificacionesComponent,
              ),
          },
        ],
      },

      // ─────────────────────────────────────
      // ALUMNO
      // ─────────────────────────────────────
      {
        path: 'alumno',
        canActivate: [hasRoleGuard(['alumno'])],
        children: [
          {
            path: 'dashboard',
            loadComponent: () =>
              import('./features/alumno/dashboard/alumno-dashboard.component').then(
                (m) => m.AlumnoDashboardComponent,
              ),
          },
          {
            path: 'clases',
            loadComponent: () =>
              import('./features/alumno/clases/alumno-clases.component').then(
                (m) => m.AlumnoClasesComponent,
              ),
          },
          {
            path: 'agendar',
            loadComponent: () =>
              import('./features/alumno/agendar/alumno-agendar.component').then(
                (m) => m.AlumnoAgendarComponent,
              ),
          },
          {
            path: 'notas',
            loadComponent: () =>
              import('./features/alumno/notas/alumno-notas.component').then(
                (m) => m.AlumnoNotasComponent,
              ),
          },
          {
            path: 'certificado',
            loadComponent: () =>
              import('./features/alumno/certificado/alumno-certificado.component').then(
                (m) => m.AlumnoCertificadoComponent,
              ),
          },
          {
            path: 'pagos',
            loadComponent: () =>
              import('./features/alumno/pagos/alumno-pagos.component').then(
                (m) => m.AlumnoPagosComponent,
              ),
          },
          {
            path: 'notificaciones',
            loadComponent: () =>
              import('./features/alumno/notificaciones/alumno-notificaciones.component').then(
                (m) => m.AlumnoNotificacionesComponent,
              ),
          },
          {
            path: 'asistencia',
            loadComponent: () =>
              import('./features/alumno/asistencia/alumno-asistencia.component').then(
                (m) => m.AlumnoAsistenciaComponent,
              ),
          },
          {
            path: 'horario',
            loadComponent: () =>
              import('./features/alumno/horario/alumno-horario.component').then(
                (m) => m.AlumnoHorarioComponent,
              ),
          },
          {
            path: 'progreso',
            loadComponent: () =>
              import('./features/alumno/progreso/alumno-progreso.component').then(
                (m) => m.AlumnoProgresoComponent,
              ),
          },
          {
            path: 'pruebas-online',
            loadComponent: () =>
              import('./features/alumno/pruebas-online/alumno-pruebas-online.component').then(
                (m) => m.AlumnoPruebasOnlineComponent,
              ),
          },
          {
            path: 'ayuda',
            loadComponent: () =>
              import('./features/alumno/ayuda/alumno-ayuda.component').then(
                (m) => m.AlumnoAyudaComponent,
              ),
          },
        ],
      },

      // ─────────────────────────────────────
      // RELATOR
      // ─────────────────────────────────────
      {
        path: 'relator',
        canActivate: [hasRoleGuard(['relator'])],
        children: [
          {
            path: 'dashboard',
            loadComponent: () =>
              import('./features/relator/dashboard/relator-dashboard.component').then(
                (m) => m.RelatorDashboardComponent,
              ),
          },
          {
            path: 'alumnos',
            loadComponent: () =>
              import('./features/relator/alumnos/relator-alumnos.component').then(
                (m) => m.RelatorAlumnosComponent,
              ),
          },
          {
            path: 'asistencia',
            loadComponent: () =>
              import('./features/relator/asistencia/relator-asistencia.component').then(
                (m) => m.RelatorAsistenciaComponent,
              ),
          },
          {
            path: 'notas',
            loadComponent: () =>
              import('./features/relator/notas/relator-notas.component').then(
                (m) => m.RelatorNotasComponent,
              ),
          },
          {
            path: 'maquinaria',
            loadComponent: () =>
              import('./features/relator/maquinaria/relator-maquinaria.component').then(
                (m) => m.RelatorMaquinariaComponent,
              ),
          },
          {
            path: 'acta-final',
            loadComponent: () =>
              import('./features/relator/acta-final/relator-acta-final.component').then(
                (m) => m.RelatorActaFinalComponent,
              ),
          },
          {
            path: 'notificaciones',
            loadComponent: () =>
              import('./features/relator/notificaciones/relator-notificaciones.component').then(
                (m) => m.RelatorNotificacionesComponent,
              ),
          },
          {
            path: 'alumno/:id',
            loadComponent: () =>
              import('./features/relator/alumno-detail/relator-alumno-detail.component').then(
                (m) => m.RelatorAlumnoDetailComponent,
              ),
          },
        ],
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
