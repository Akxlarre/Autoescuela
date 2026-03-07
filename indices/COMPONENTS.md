# Registro de Componentes (Atomic Design)

> **Regla de Actualización (OBLIGATORIA):** El Agente DEBE usar sus herramientas de sistema (escritura de archivos) para agregar los nuevos componentes a estas tablas. Solo si el entorno no los soporta, usa el bloque `<memory_update>` para que el humano lo copie.

## Átomos (Atoms)
*Elementos UI básicos e indivisibles (botones, inputs, badges).*

| Componente | Tipo/Categoría | Props principales | Ubicación | Estado |
|------------|----------------|-------------------|-----------|--------|
| `skeleton-block` | Loading | `variant` (`rect`, `circle`, `text`), `width`, `height` | `shared/components/skeleton-block/skeleton-block.component.ts` | ✅ Estable |
| `app-icon` | Ícono (Lucide) | `name` (requerido, kebab-case), `size` (default 16), `color` (default currentColor), `ariaHidden` (default true) | `shared/components/icon/icon.component.ts` | ✅ Estable |

## Moléculas (Molecules)
*Agrupación de átomos que forman una unidad funcional simple (search bar, card preview).*

| Componente | Tipo/Categoría | Props principales | Ubicación | Estado |
|------------|----------------|-------------------|-----------|--------|
| `app-kpi-card` | KPI / Métrica | `value` (number, req), `label` (string, req), `suffix` (''), `prefix` (''), `trend` (number|undefined), `trendLabel` (''), `accent` (false), `icon` (string|undefined), `size` ('lg'|'md'|'sm', default 'lg'), `color` ('default'|'success'|'warning'|'error', default 'default') | `shared/components/kpi-card/kpi-card.component.ts` | ✅ Estable |
| `app-kpi-card-variant` | KPI / Métrica con Carga | Igual a `app-kpi-card` pero recibe un input `loading` (boolean signal) para renderizar su propio skeleton usando Single-Component Skeleton pattern sin CLS. | `shared/components/kpi-card/kpi-card-variant.component.ts` | ✅ Estable |
| `app-action-kpi-card` | KPI / Métrica Interactiva | Variante de KPI con soporte para interacción (hover GSAP, cursor pointer), colores semánticos, pulso opcional en ícono y slot para footer. | `shared/components/kpi-card/action-kpi-card.component.ts` | ✅ Estable |

## Moléculas — Feedback
*Comunicación de estados del sistema al usuario.*

| Componente | Tipo/Categoría | Props principales | Ubicación | Estado |
|------------|----------------|-------------------|-----------|--------|
| `app-empty-state` | Estado vacío | `message` (string, req), `subtitle` (string), `icon` (Lucide kebab-case), `actionLabel` (string), `actionIcon` (default 'plus'), `(action)` output | `shared/components/empty-state/empty-state.component.ts` | ✅ Estable |
| `app-alert-card` | Alerta / Feedback | `title` (string, req), `severity` ('error'|'warning'|'info'|'success', default 'info'), `actionLabel` (string), `dismissible` (boolean), `(action)` output, `(dismissed)` output. Body via `ng-content`. | `shared/components/alert-card/alert-card.component.ts` | ✅ Estable |

## Moléculas — Shell / Topbar
*Dropdowns y paneles del shell de la aplicación.*

| Componente | Tipo/Categoría | Props principales | Ubicación | Estado |
|------------|----------------|-------------------|-----------|--------|
| `app-notifications-panel` | Dropdown / Panel | `notifications` (Notification[], req), `unreadCount` (number, 0) — outputs: `markRead` (string), `markAllRead` (void). Dumb: sin servicios. Entrada animada con `[appAnimateIn]` desde TopbarComponent. | `shared/components/notifications-panel/notifications-panel.component.ts` | ✅ Estable |
| `app-search-panel` | Dropdown / Buscador global | Sin inputs. outputs: `queryChange` (string), `closed` (void). Dumb: query es estado local (`signal`). Autofocus al montar. Escape emite `closed`. Entrada animada con `[appAnimateIn]`. | `shared/components/search-panel/search-panel.component.ts` | ✅ Estable |
| `app-user-panel` | Dropdown / Panel | `user` (User, req) — outputs: `action` (string), `logout` (void). Dumb: sin servicios. Menú desplegable para opciones de usuario desde TopbarComponent animado con `[appAnimateIn]`. | `shared/components/user-panel/user-panel.component.ts` | ✅ Estable |

## Organismos (Organisms)
*Secciones complejas y autónomas compuestas por moléculas y átomos.*

| Componente | Tipo/Categoría | Props principales | Ubicación | Estado |
|------------|----------------|-------------------|-----------|--------|
| `app-drawer` | Overlay / Drawer | `isOpen` (boolean signal, req), `title` (string, req), `icon` (string), `hasFooter` (boolean) — outputs: `closed`. Dumb: animaciones con GSAP, content project. | `shared/components/drawer/drawer.component.ts` | ✅ Estable |
| `app-alumnos-list-content` | Organismo / Tabla (Dumb) | `basePath` (string, req), `alumnos` (`AlumnoTableRow[]`, []), `isLoading` (boolean, false), `alumnosPorVencer` (`AlumnoTableRow[]`, []) — output: `refreshRequested`. Búsqueda, filtros, KPIs y tabla PrimeNG. La data real la pasa el padre smart (`AdminAlumnosComponent` / `SecretariaAlumnosComponent`) vía `AdminAlumnosFacade`. | `shared/components/alumnos-list-content/alumnos-list-content.component.ts` | ✅ Estable |

## Layout (Shell)
*Componentes estructurales del shell de la aplicación — no son páginas enrutables.*

| Componente | Tipo | Propósito | Ubicación | Estado |
|------------|------|-----------|-----------|--------|
| `AppShellComponent` | Smart | Layout principal: sidebar + topbar + router-outlet; drawer animado en mobile. Sin View Transitions ni animatePageEnter (evitar race conditions). | `layout/app-shell.component.ts` | ✅ Estable |
| `SidebarComponent` | Smart | Sidebar de navegación con grupos (`NavGroup[]`): headers de sección + pills GSAP, theme toggle y avatar de usuario | `layout/sidebar.component.ts` | ✅ Estable |
| `TopbarComponent` | Smart | Barra superior: selector DEV de rol (ROL dropdown), búsqueda global (Ctrl+K), cambio de tema, badge notificaciones (`animateBell`), avatar de usuario | `layout/topbar.component.ts` | ✅ Estable |
| `LayoutDrawerComponent` | Smart (Adaptativo) | Panel lateral dinámico. **Desktop (≥768px):** layout-shift (empuja el contenido). **Mobile (<768px):** fullscreen fixed + backdrop GSAP + scroll lock. Renderiza componentes via `NgComponentOutlet`. Controlado por `LayoutDrawerService` (usa `LayoutDrawerFacadeService` desde UI). | `layout/layout-drawer.component.ts` | ✅ Estable |

## Moléculas — Auth
*Formularios y flujos de autenticación.*

| Componente | Tipo/Categoría | Props principales | Ubicación | Estado |
|------------|----------------|-------------------|-----------|--------|
| `app-login-card` | Auth / Form | `mode` ('login'|'reset'), `loading` (false), `errorMsg` (''), `successMsg` ('') — outputs: `modeChange`, `formSubmit` (LoginFormData). Sin `@if` para layout: contraseña y mensajes siempre en DOM, GSAP anima `height`+`opacity` vía `effect()` + `viewChild`. `LoginFormData`: `{ email, password }`. | `shared/components/login-card/login-card.component.ts` | ✅ Estable |

## Páginas / Vistas (Pages)
*Componentes enrutables (Smart components) que consumen Servicios.*

| Ruta / Componente | Propósito | Servicios Inyectados | Ubicación | Estado |
|-------------------|-----------|-----------------------|-----------|--------|
| `/app/admin/dashboard` — `DashboardComponent` | Dashboard principal (referencia canónica del DS): KPIs, bento-grid, app-kpi-card, surface-hero, indicator-live, [appCardHover]. | `AuthFacade` | `features/dashboard/dashboard.component.ts` | ✅ Estable (datos estáticos) |
| `/login` — `LoginComponent` | Login y reset de contraseña. Orbs decorativos + `surface-glass` card. Entrada con `GsapAnimationsService.animateHero()`. Botón dev `isDevMode()`. | `AuthFacade`, `GsapAnimationsService` | `features/auth/login/login.component.ts` | ✅ Estable |
| `/**` — `NotFoundComponent` | Página 404 | — | `features/not-found/not-found.component.ts` | ✅ Estable |
| **— PORTAL ADMIN (24 stubs) —** | | | | |
| `/app/admin/alumnos` | **Base de Alumnos** — Implementación calco del mockup. Reutiliza `AlumnosListContentComponent`. | — | `features/admin/alumnos/admin-alumnos.component.ts` | ✅ UI Ready |
| `/app/admin/agenda` | Stub PLANO | — | `features/admin/agenda/admin-agenda.component.ts` | 🚧 Stub |
| `/app/admin/asistencia` | Stub PLANO | — | `features/admin/asistencia/admin-asistencia.component.ts` | 🚧 Stub |
| `/app/admin/matricula` | **Wizard 6 Pasos (Nueva Matrícula)** — Thin wrapper que reutiliza `SecretariaMatriculaComponent`. Pasos: Datos Personales, Adscripción, Documentos, Pago/Descuentos, Contrato (RF-083), Confirmación. | — | `features/admin/matricula/admin-matricula.component.ts` | ✅ UI Ready |
| `/app/admin/pagos` | Stub PLANO | — | `features/admin/pagos/admin-pagos.component.ts` | 🚧 Stub |
| `/app/admin/contabilidad/reportes` | Stub PLANO | — | `features/admin/contabilidad-reportes/admin-contabilidad-reportes.component.ts` | 🚧 Stub |
| `/app/admin/contabilidad/cuadratura` | Stub PLANO | — | `features/admin/contabilidad-cuadratura/admin-contabilidad-cuadratura.component.ts" | 🚧 Stub |
| `/app/admin/contabilidad/anticipos` | Stub PLANO | — | `features/admin/contabilidad-anticipos/admin-contabilidad-anticipos.component.ts` | 🚧 Stub |
| `/app/admin/contabilidad/cursos` | Stub PLANO | — | `features/admin/contabilidad-cursos/admin-contabilidad-cursos.component.ts` | 🚧 Stub |
| `/app/admin/flota` | Stub PLANO | — | `features/admin/flota/admin-flota.component.ts` | 🚧 Stub |
| `/app/admin/instructores` | Stub PLANO | — | `features/admin/instructores/admin-instructores.component.ts` | 🚧 Stub |
| `/app/admin/certificacion` | Stub PLANO | — | `features/admin/certificacion/admin-certificacion.component.ts` | 🚧 Stub |
| `/app/admin/documentos` | Stub PLANO | — | `features/admin/documentos/admin-documentos.component.ts` | 🚧 Stub |
| `/app/admin/usuarios` | Stub PLANO | — | `features/admin/usuarios/admin-usuarios.component.ts` | 🚧 Stub |
| `/app/admin/secretarias` | Stub PLANO | — | `features/admin/secretarias/admin-secretarias.component.ts` | 🚧 Stub |
| `/app/admin/tareas` | Stub PLANO | — | `features/admin/tareas/admin-tareas.component.ts` | 🚧 Stub |
| `/app/admin/libro-de-clases` | Stub PLANO | — | `features/admin/libro-de-clases/admin-libro-de-clases.component.ts` | 🚧 Stub |
| `/app/admin/psicotecnico` | Stub PLANO | — | `features/admin/psicotecnico/admin-psicotecnico.component.ts` | 🚧 Stub |
| `/app/admin/clase-profesional/relatores` | Stub PLANO | — | `features/admin/profesional-relatores/admin-profesional-relatores.component.ts` | 🚧 Stub |
| `/app/admin/clase-profesional/promociones` | Stub PLANO | — | `features/admin/profesional-promociones/admin-profesional-promociones.component.ts` | 🚧 Stub |
| `/app/admin/clase-profesional/certificados` | Stub PLANO | — | `features/admin/profesional-certificados/admin-profesional-certificados.component.ts` | 🚧 Stub |
| `/app/admin/clase-profesional/archivo` | Stub PLANO | — | `features/admin/profesional-archivo/admin-profesional-archivo.component.ts` | 🚧 Stub |
| `/app/admin/auditoria` | Stub PLANO | — | `features/admin/auditoria/admin-auditoria.component.ts` | 🚧 Stub |
| `/app/admin/notificaciones` | Stub PLANO | — | `features/admin/notificaciones/admin-notificaciones.component.ts` | 🚧 Stub |
| **— PORTAL SECRETARIA (23 stubs) —** | | | | |
| `/app/secretaria/dashboard` | Stub PLANO | — | `features/secretaria/dashboard/secretaria-dashboard.component.ts` | 🚧 Stub |
| `/app/secretaria/alumnos` | **Base de Alumnos** — Implementación calco del mockup. Reutiliza `AlumnosListContentComponent`. | — | `features/secretaria/alumnos/secretaria-alumnos.component.ts` | ✅ UI Ready |
| `/app/secretaria/agenda` | Stub PLANO | — | `features/secretaria/agenda/secretaria-agenda.component.ts` | 🚧 Stub |
| `/app/secretaria/asistencia` | Stub PLANO | — | `features/secretaria/asistencia/secretaria-asistencia.component.ts` | 🚧 Stub |
| `/app/secretaria/matricula` | **Wizard 6 Pasos (Nueva Matrícula)** — PrimeNG Stepper (`.stepper-premium`), 6 `p-step-panel`. Signals locales, OnPush. Todos los inputs/outputs del mockup Astro. Pasos: Datos Personales, Adscripción (cat+tipo curso+SENCE), Documentos (foto+upload condicional), Pago/Descuentos, Contrato digital + firma electrónica (RF-083), Confirmación. | — | `features/secretaria/matricula/secretaria-matricula.component.ts` | ✅ UI Ready |
| `/app/secretaria/pagos` | Stub PLANO | — | `features/secretaria/pagos/secretaria-pagos.component.ts" | 🚧 Stub |
| `/app/secretaria/contabilidad/cuadratura` | Stub PLANO | — | `features/secretaria/contabilidad-cuadratura/secretaria-contabilidad-cuadratura.component.ts" | 🚧 Stub |
| `/app/secretaria/contabilidad/reportes` | Stub PLANO | — | `features/secretaria/contabilidad-reportes/secretaria-contabilidad-reportes.component.ts" | 🚧 Stub |
| `/app/secretaria/certificados` | Stub PLANO | — | `features/secretaria/certificados/secretaria-certificados.component.ts" | 🚧 Stub |
| `/app/secretaria/documentos` | Stub PLANO | — | `features/secretaria/documentos/secretaria-documentos.component.ts" | 🚧 Stub |
| `/app/secretaria/instructores` | Stub PLANO | — | `features/secretaria/instructores/secretaria-instructores.component.ts" | 🚧 Stub |
| `/app/secretaria/comunicaciones` | Stub PLANO | — | `features/secretaria/comunicaciones/secretaria-comunicaciones.component.ts" | 🚧 Stub |
| `/app/secretaria/observaciones` | Stub PLANO | — | `features/secretaria/observaciones/secretaria-observaciones.component.ts" | 🚧 Stub |
| `/app/secretaria/psicotecnico` | Stub PLANO | — | `features/secretaria/psicotecnico/secretaria-psicotecnico.component.ts" | 🚧 Stub |
| `/app/secretaria/profesional/relatores` | Stub PLANO | — | `features/secretaria/profesional-relatores/secretaria-profesional-relatores.component.ts" | 🚧 Stub |
| `/app/secretaria/profesional/promociones` | Stub PLANO | — | `features/secretaria/profesional-promociones/secretaria-profesional-promociones.component.ts" | 🚧 Stub |
| `/app/secretaria/profesional/notas` | Stub PLANO | — | `features/secretaria/profesional-notas/secretaria-profesional-notas.component.ts" | 🚧 Stub |
| `/app/secretaria/profesional/certificados` | Stub PLANO | — | `features/secretaria/profesional-certificados/secretaria-profesional-certificados.component.ts" | 🚧 Stub |
| `/app/secretaria/profesional/archivo` | Stub PLANO | — | `features/secretaria/profesional-archivo/secretaria-profesional-archivo.component.ts" | 🚧 Stub |
| `/app/secretaria/notificaciones` | Stub PLANO | — | `features/secretaria/notificaciones/secretaria-notificaciones.component.ts" | 🚧 Stub |
| `/app/secretaria/libro-de-clases` | Stub PLANO — mockup: `libro-de-clases.astro` (raíz) | — | `features/secretaria/libro-de-clases/secretaria-libro-de-clases.component.ts" | 🚧 Stub |
| `/app/secretaria/ex-alumnos` | Stub PLANO | — | `features/secretaria/ex-alumnos/secretaria-ex-alumnos.component.ts" | 🚧 Stub |
| `/app/secretaria/servicios-especiales` | Stub PLANO | — | `features/secretaria/servicios-especiales/secretaria-servicios-especiales.component.ts" | 🚧 Stub |
| **— PORTAL INSTRUCTOR (9 stubs) —** | | | | |
| `/app/instructor/dashboard` | Stub PLANO | — | `features/instructor/dashboard/instructor-dashboard.component.ts" | 🚧 Stub |
| `/app/instructor/alumnos` | Stub PLANO | — | `features/instructor/alumnos/instructor-alumnos.component.ts" | 🚧 Stub |
| `/app/instructor/clase/iniciar` | Stub PLANO | — | `features/instructor/clase/instructor-clase.component.ts" | 🚧 Stub |
| `/app/instructor/horario` | Stub PLANO | — | `features/instructor/horario/instructor-horario.component.ts" | 🚧 Stub |
| `/app/instructor/ensayos-teoricos` | Stub PLANO | — | `features/instructor/ensayos-teoricos/instructor-ensayos-teoricos.component.ts" | 🚧 Stub |
| `/app/instructor/liquidacion` | Stub PLANO | — | `features/instructor/liquidacion/instructor-liquidacion.component.ts" | 🚧 Stub |
| `/app/instructor/notificaciones` | Stub PLANO | — | `features/instructor/notificaciones/instructor-notificaciones.component.ts" | 🚧 Stub |
| `/app/instructor/asistencia` | Stub PLANO | — | `features/instructor/asistencia/instructor-asistencia.component.ts" | 🚧 Stub |
| `/app/instructor/ayuda` | Stub PLANO | — | `features/instructor/ayuda/instructor-ayuda.component.ts" | 🚧 Stub |
| **— PORTAL ALUMNO (12 stubs) —** | | | | |
| `/app/alumno/dashboard` | Stub PLANO | — | `features/alumno/dashboard/alumno-dashboard.component.ts" | 🚧 Stub |
| `/app/alumno/clases` | Stub PLANO | — | `features/alumno/clases/alumno-clases.component.ts" | 🚧 Stub |
| `/app/alumno/agendar` | Stub PLANO | — | `features/alumno/agendar/alumno-agendar.component.ts" | 🚧 Stub |
| `/app/alumno/notas` | Stub PLANO | — | `features/alumno/notas/alumno-notas.component.ts" | 🚧 Stub |
| `/app/alumno/certificado` | Stub PLANO | — | `features/alumno/certificado/alumno-certificado.component.ts" | 🚧 Stub |
| `/app/alumno/pagos` | Stub PLANO | — | `features/alumno/pagos/alumno-pagos.component.ts" | 🚧 Stub |
| `/app/alumno/notificaciones` | Stub PLANO | — | `features/alumno/notificaciones/alumno-notificaciones.component.ts" | 🚧 Stub |
| `/app/alumno/asistencia` | Stub PLANO | — | `features/alumno/asistencia/alumno-asistencia.component.ts" | 🚧 Stub |
| `/app/alumno/horario` | Stub PLANO | — | `features/alumno/horario/alumno-horario.component.ts" | 🚧 Stub |
| `/app/alumno/progreso` | Stub PLANO | — | `features/alumno/progreso/alumno-progreso.component.ts" | 🚧 Stub |
| `/app/alumno/pruebas-online` | Stub PLANO | — | `features/alumno/pruebas-online/alumno-pruebas-online.component.ts" | 🚧 Stub |
| `/app/alumno/ayuda` | Stub PLANO | — | `features/alumno/ayuda/alumno-ayuda.component.ts" | 🚧 Stub |
| **— PORTAL RELATOR (6 stubs) —** | | | | |
| `/app/relator/dashboard` | Stub PLANO | — | `features/relator/dashboard/relator-dashboard.component.ts" | 🚧 Stub |
| `/app/relator/alumnos` | Stub PLANO | — | `features/relator/alumnos/relator-alumnos.component.ts" | 🚧 Stub |
| `/app/relator/asistencia` | Stub PLANO | — | `features/relator/asistencia/relator-asistencia.component.ts" | 🚧 Stub |
| `/app/relator/notas` | Stub PLANO | — | `features/relator/notas/relator-notas.component.ts" | 🚧 Stub |
| `/app/relator/maquinaria` | Stub PLANO | — | `features/relator/maquinaria/relator-maquinaria.component.ts" | 🚧 Stub |
| `/app/relator/acta-final` | Stub PLANO | — | `features/relator/acta-final/relator-acta-final.component.ts" | 🚧 Stub |

