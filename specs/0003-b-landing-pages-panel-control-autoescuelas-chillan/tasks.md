# Checklist de Tareas — Spec 0003-b — Landing Pages & Panel de Control

Este archivo detalla el progreso y la culminación de las tareas requeridas para implementar el panel de control multi-tenant de las autoescuelas de Chillán en Koa.

## Fase 1: Infraestructura y Base de Datos
- [x] **T1.1: Registro de Icono**: Verificar y registrar el ícono `Globe` de Lucide en `provideIcons()` dentro de [app.config.ts](file:///C:/Users/Akxlarre/Autoescuela/src/app/app.config.ts).
- [x] **T1.2: Migración SQL para Auditoría**: Crear la migración `20260522000001_website_config_audit_trigger.sql` para asociar la función `log_change()` como trigger sobre `website_config`.

## Fase 2: Lógica de Dominio (TDD)
- [x] **T2.1: Suite de Pruebas Unitarias**: Crear el archivo de especificaciones [website-config.facade.spec.ts](file:///C:/Users/Akxlarre/Autoescuela/src/app/core/facades/website-config.facade.spec.ts) definiendo los casos de prueba para `loadConfig` (SWR, semilla por defecto AC-E1, fallos) y `saveConfig` (UPSERT, RLS 42501 AC-E2, éxito).
- [x] **T2.2: Implementación de la Fachada**: Crear [website-config.facade.ts](file:///C:/Users/Akxlarre/Autoescuela/src/app/core/facades/website-config.facade.ts) exponiendo señales de solo lectura (`config`, `isLoading`, `isSaving`, `error`), integrando caché SWR e hidratación de semillas pre-estructuradas.
- [x] **T2.3: Validación de Tests**: Ejecutar la suite de pruebas unitarias y verificar el paso exitoso de los 8 tests diseñados.

## Fase 3: Rutas, Navegación e Interfaz de Usuario
- [x] **T3.1: Lazy Routing**: Declarar e integrar de forma perezosa la ruta `/configuracion-web` bajo los prefijos de `/app/admin` y `/app/secretaria` en [app.routes.ts](file:///C:/Users/Akxlarre/Autoescuela/src/app/app.routes.ts).
- [x] **T3.2: Navegación del Sidebar**: Registrar el enlace "Configuración Web" usando el ícono `globe` en [menu-config.service.ts](file:///C:/Users/Akxlarre/Autoescuela/src/app/core/services/auth/menu-config.service.ts) para los roles `admin` y `secretaria`.
- [x] **T3.3: Bento UI Smart Component**: Desarrollar [admin-configuracion-web.component.ts](file:///C:/Users/Akxlarre/Autoescuela/src/app/features/admin/configuracion-web/admin-configuracion-web.component.ts) incluyendo:
  - Diseño Bento Grid autolayout interactivo.
  - Micro-animaciones de entrada en caliente usando GSAP.
  - Soporte de 6 pestañas funcionales (Identidad, Hero, Cursos, Promociones, Ubicación, FAQs).
  - Formularios reactivos dinámicos (`FormArray` para cursos y preguntas frecuentes).
  - Selector exclusivo para Admin con sandbox restrictivo para Secretaria mediante RLS en backend.

## Fase 4: Aseguramiento y Cierre de Ciclo de Vida
- [x] **T4.1: Auditoría Arquitectónica y Build**: Ejecutar los linters arquitectónicos locales y compilar el bundle de producción para asegurar cero advertencias o errores.
- [x] **T4.2: Documentación de Verificación**: Poblar los archivos `tasks.md` y `acceptance.md` con las firmas de aceptación y criterios de éxito.
- [x] **T4.3: Roadmap Sync**: Mover Spec 0003-b al estado `Done` en [ROADMAP.md](file:///C:/Users/Akxlarre/Autoescuela/specs/ROADMAP.md) y documentar los resultados finales.
