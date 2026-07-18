# Tasks Checklist — Spec 0007-b

Esta lista de tareas detalla el trabajo requerido durante la fase de ejecución para completar la Spec 0007-b.

## Tareas de Reorganización y Diseño

- [ ] **T1: Refactor de Configuración de Rutas**
  - [ ] Modificar interfaces `NavItem` y `NavGroup` en `menu-config.service.ts` para soportar `requiresProfessional`.
  - [ ] Organizar `ADMIN_NAV` y `SECRETARIA_NAV` en los 5 Hubs cotidianos definidos.
  - [ ] Remover las 4 rutas secundarias administrativas del menú lateral.

- [ ] **T2: Implementación de Sidebar Colapsable y Candados**
  - [ ] Inyectar `BranchFacade` en `SidebarComponent`.
  - [ ] Crear propiedad computada reactiva `hasProfessional` para determinar tipo de sede activa.
  - [ ] Maquetar estilo de atenuación al 50% e icono `🔒` para navs bloqueados.
  - [ ] Codificar el interceptor de click para abrir el modal explicativo y conmutador rápido de sede.

- [ ] **T3: Diseño y Desarrollo del Drawer de Ajustes**
  - [ ] Crear `AjustesDrawerComponent` con OnPush y diseño premium de tabs.
  - [ ] Desarrollar la pestaña **Mi Perfil** para datos de la cuenta actual.
  - [ ] Incrustar la pestaña **Sitio Web** inyectando `WebsiteConfigFacade` para edición en vivo de la landing.
  - [ ] Crear la pestaña **Colaboradores** para creación de cuentas de secretarias y personal.
  - [ ] Añadir la pestaña **Seguridad** (exclusiva para rol Admin) que consume `AuditoriaFacade`.
  - [ ] Integrar `ConfirmModalService` para control de salida con cambios pendientes.

- [ ] **T4: Integración del Panel de Usuario**
  - [ ] Sincronizar outputs `action` ('profile' / 'settings') de `UserPanelComponent` para invocar la apertura del cajón de ajustes.
  - [ ] Probar la transición GSAP y View Transition de los overlays.
