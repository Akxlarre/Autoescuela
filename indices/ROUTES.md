# Registro de Rutas

> **Fuente:** auto-generado desde `src/app/app.routes.ts` con `npm run indices:sync`.
> Consultar aquí ANTES de buscar una página: path → componente → guards.
>
> **Nota de herencia:** los guards listados son los propios de cada ruta; las rutas hijas
> heredan además los guards de sus prefijos (ej: todo `/app/**` pasa por `authGuard`, todo
> `/app/admin/**` por `hasRoleGuard(['admin'])`).

## Mapa de rutas

<!-- AUTO-GENERATED:BEGIN -->
| Path | Componente | Guards | Archivo de rutas |
|------|-----------|--------|------------------|
| `/login` | `LoginComponent` | `guestGuard` | `src/app/app.routes.ts` |
| `/force-password-change` | `ForcePasswordChangeComponent` | `firstLoginGuard` | `src/app/app.routes.ts` |
| `/recuperar-contrasena` | `RecuperarContrasenaComponent` | `guestGuard` | `src/app/app.routes.ts` |
| `/acceso-denegado` | `AccesoDenegadoComponent` | — | `src/app/app.routes.ts` |
| `/inscripcion` | `PublicEnrollmentComponent` | — | `src/app/app.routes.ts` |
| `/inscripcion/retorno` | `PublicEnrollmentRetornoComponent` | — | `src/app/app.routes.ts` |
| `/app` | `AppShellComponent` | `authGuard` | `src/app/app.routes.ts` |
| `/app` | — | `roleRedirectGuard` | `src/app/app.routes.ts` |
| `/app/admin` | — | `hasRoleGuard(['admin'])` | `src/app/app.routes.ts` |
| `/app/admin/dashboard` | `DashboardComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/alumnos` | `AdminAlumnosComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/clase-profesional/alumnos` | `AdminAlumnosProfesionalComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/clase-profesional/pre-inscritos` | `AdminPreInscritosComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/alumnos/:id` | `AdminAlumnoDetalleComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/ex-alumnos` | `AdminExAlumnosComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/ex-alumnos-profesional` | `AdminExAlumnosProfesionalComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/agenda` | `AdminAgendaComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/asistencia` | `AdminAsistenciaComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/matricula` | `AdminMatriculaComponent` | `enrollmentDraftGuard` | `src/app/app.routes.ts` |
| `/app/admin/pagos` | `AdminPagosComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/contabilidad/reportes` | `AdminContabilidadReportesComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/contabilidad/cuadratura` | `AdminContabilidadCuadraturaComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/contabilidad/anticipos` | `AdminContabilidadAnticiposComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/contabilidad/historial-cuadraturas` | `AdminContabilidadHistorialCuadraturasComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/contabilidad/liquidaciones` | `AdminContabilidadLiquidacionesComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/contabilidad/cursos` | `AdminContabilidadCursosComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/flota` | `AdminFlotaComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/flota/hoja-de-ruta/:id` | `RouteSheetComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/flota/:id/mantenimientos` | `VehicleMaintenancesComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/instructores` | `AdminInstructoresComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/certificacion` | `AdminCertificacionComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/documentos` | `AdminDocumentosComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/documentos/alumnos/:id` | `AdminAlumnoDocsDetalleComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/usuarios` | `AdminUsuariosComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/secretarias` | `AdminSecretariasComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/tareas` | `AdminTareasComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/libro-de-clases` | `AdminLibroDeClasesComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/servicios-especiales` | `AdminServiciosEspecialesComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/notificaciones` | `AdminNotificacionesComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/clase-profesional/relatores` | `AdminProfesionalRelatoresComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/clase-profesional/promociones` | `AdminProfesionalPromocionesComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/clase-profesional/asistencia` | `AdminProfesionalAsistenciaComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/clase-profesional/certificados` | `AdminProfesionalCertificadosComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/clase-profesional/evaluaciones` | `AdminProfesionalEvaluacionesComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/clase-profesional/archivo` | `AdminProfesionalArchivoComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/auditoria` | `AdminAuditoriaComponent` | — | `src/app/app.routes.ts` |
| `/app/admin/configuracion-web` | `AdminConfiguracionWebComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria` | — | `hasRoleGuard(['secretaria'])` | `src/app/app.routes.ts` |
| `/app/secretaria/dashboard` | `SecretariaDashboardComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/alumnos` | `SecretariaAlumnosComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/alumnos/:id` | `AdminAlumnoDetalleComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/profesional/alumnos` | `SecretariaAlumnosProfesionalComponent` | `professionalBranchGuard` | `src/app/app.routes.ts` |
| `/app/secretaria/profesional/pre-inscritos` | `SecretariaAlumnosPreInscritosComponent` | `professionalBranchGuard` | `src/app/app.routes.ts` |
| `/app/secretaria/agenda` | `SecretariaAgendaComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/asistencia` | `SecretariaAsistenciaComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/asistencia/matriz` | `SecretariaAsistenciaMatrizComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/matricula` | `SecretariaMatriculaComponent` | `enrollmentDraftGuard` | `src/app/app.routes.ts` |
| `/app/secretaria/pagos` | `SecretariaPagosComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/contabilidad/cuadratura` | `SecretariaContabilidadCuadraturaComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/contabilidad/reportes` | `SecretariaContabilidadReportesComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/contabilidad/historial-cuadraturas` | `SecretariaContabilidadHistorialCuadraturasComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/contabilidad/liquidaciones` | `SecretariaContabilidadLiquidacionesComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/certificados` | `SecretariaCertificadosComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/documentos` | `SecretariaDocumentosComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/documentos/alumnos/:id` | `AdminAlumnoDocsDetalleComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/instructores` | `SecretariaInstructoresComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/comunicaciones` | `SecretariaComunicacionesComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/observaciones` | `SecretariaObservacionesComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/profesional/relatores` | `SecretariaProfesionalRelatoresComponent` | `professionalBranchGuard` | `src/app/app.routes.ts` |
| `/app/secretaria/profesional/promociones` | `SecretariaProfesionalPromocionesComponent` | `professionalBranchGuard` | `src/app/app.routes.ts` |
| `/app/secretaria/profesional/asistencia` | `SecretariaProfesionalAsistenciaComponent` | `professionalBranchGuard` | `src/app/app.routes.ts` |
| `/app/secretaria/profesional/notas` | `SecretariaProfesionalNotasComponent` | `professionalBranchGuard` | `src/app/app.routes.ts` |
| `/app/secretaria/profesional/certificados` | `SecretariaProfesionalCertificadosComponent` | `professionalBranchGuard` | `src/app/app.routes.ts` |
| `/app/secretaria/profesional/archivo` | `SecretariaProfesionalArchivoComponent` | `professionalBranchGuard` | `src/app/app.routes.ts` |
| `/app/secretaria/notificaciones` | `SecretariaNotificacionesComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/ex-alumnos` | `SecretariaExAlumnosComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/ex-alumnos-profesional` | `SecretariaExAlumnosProfesionalComponent` | `professionalBranchGuard` | `src/app/app.routes.ts` |
| `/app/secretaria/servicios-especiales` | `SecretariaServiciosEspecialesComponent` | — | `src/app/app.routes.ts` |
| `/app/secretaria/libro-de-clases` | `SecretariaLibroDeClasesComponent` | `professionalBranchGuard` | `src/app/app.routes.ts` |
| `/app/secretaria/configuracion-web` | `AdminConfiguracionWebComponent` | — | `src/app/app.routes.ts` |
| `/app/instructor` | — | `hasRoleGuard(['instructor'])` | `src/app/app.routes.ts` |
| `/app/instructor/dashboard` | `InstructorDashboardComponent` | — | `src/app/app.routes.ts` |
| `/app/instructor/alumnos` | `InstructorAlumnosComponent` | — | `src/app/app.routes.ts` |
| `/app/instructor/alumnos/:id` | → redirect a `:id/ficha` | — | `src/app/app.routes.ts` |
| `/app/instructor/alumnos/:id/ficha` | `InstructorFichaComponent` | — | `src/app/app.routes.ts` |
| `/app/instructor/alumnos/:id/evaluacion/:sessionId` | `InstructorEvaluacionComponent` | — | `src/app/app.routes.ts` |
| `/app/instructor/clase/iniciar` | `InstructorClaseComponent` | — | `src/app/app.routes.ts` |
| `/app/instructor/clase/:id` | `InstructorClaseDetailComponent` | — | `src/app/app.routes.ts` |
| `/app/instructor/ficha/:id` | → redirect a `alumnos/:id/ficha` | — | `src/app/app.routes.ts` |
| `/app/instructor/horario` | `InstructorHorarioComponent` | — | `src/app/app.routes.ts` |
| `/app/instructor/ensayos-teoricos` | `InstructorEnsayosTeoricosComponent` | — | `src/app/app.routes.ts` |
| `/app/instructor/liquidacion` | `InstructorLiquidacionComponent` | — | `src/app/app.routes.ts` |
| `/app/instructor/notificaciones` | `InstructorNotificacionesComponent` | — | `src/app/app.routes.ts` |
| `/app/instructor/tareas` | `InstructorTareasComponent` | — | `src/app/app.routes.ts` |
| `/app/alumno` | — | `hasRoleGuard(['alumno'])` | `src/app/app.routes.ts` |
| `/app/alumno/dashboard` | `AlumnoDashboardComponent` | — | `src/app/app.routes.ts` |
| `/app/alumno/clases` | `AlumnoClasesComponent` | — | `src/app/app.routes.ts` |
| `/app/alumno/pagos` | `AlumnoPagosComponent` | — | `src/app/app.routes.ts` |
| `/app/alumno/pagar` | `AlumnoPagarComponent` | — | `src/app/app.routes.ts` |
| `/app/alumno/pagar/retorno` | `AlumnoPagarRetornoComponent` | — | `src/app/app.routes.ts` |
| `/app/alumno/notificaciones` | `AlumnoNotificacionesComponent` | — | `src/app/app.routes.ts` |
| `/app/alumno/horario` | `AlumnoHorarioComponent` | — | `src/app/app.routes.ts` |
| `/app/alumno/pruebas-online` | `AlumnoPruebasOnlineComponent` | — | `src/app/app.routes.ts` |
| `/app/alumno/ayuda` | `AlumnoAyudaComponent` | — | `src/app/app.routes.ts` |
| `/` | → redirect a `/login` | — | `src/app/app.routes.ts` |
| `/**` | `NotFoundComponent` | — | `src/app/app.routes.ts` |

<!-- AUTO-GENERATED:END -->
