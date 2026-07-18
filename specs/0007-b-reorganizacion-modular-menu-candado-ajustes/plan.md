# Plan de Implementación — Spec 0007-b

Este plan describe en detalle las modificaciones a realizar en el código para implementar la reorganización modular de la navegación, el candado de sede reactivo y el cajón de ajustes centralizado.

---

## 1. Módulos y Archivos Afectados

```
src/app/
├── core/
│   └── services/
│       └── auth/
│           └── menu-config.service.ts  <-- Reorganización de NavGroups
├── layout/
│   ├── sidebar.component.ts            <-- Acordeón colapsable + candados + settings trigger
│   └── app-shell.component.ts          <-- Validación general y acoplamiento
├── shared/
│   └── components/
│       ├── user-panel/
│       │   └── user-panel.component.ts <-- Sincronizar outputs de perfil/ajustes
│       └── ajustes-drawer/             <-- [NEW] Cajón de ajustes y control
│           ├── ajustes-drawer.component.ts
│           └── ajustes-drawer.component.scss
```

---

## 2. Paso a Paso de la Implementación

### Paso 1: Refactor de `MenuConfigService`
*   Modificar `NavItem` en `menu-config.service.ts` para soportar la bandera `requiresProfessional`.
*   Estructurar `ADMIN_NAV` y `SECRETARIA_NAV` bajo los 5 hubs:
    *   `Control de Vuelo`
    *   `Academia Clase B`
    *   `Academia Profesional` (con `requiresProfessional: true`)
    *   `Finanzas y Caja`
    *   `Recursos y Logística`
*   Eliminar del listado del sidebar las rutas administrativas secundarias: `/configuracion-web`, `/secretarias`, `/usuarios` y `/auditoria`.

### Paso 2: Agregar Soporte de Candados en el Sidebar
*   En `sidebar.component.ts`, inyectar `BranchFacade` y `LayoutDrawerFacadeService`.
*   Crear una propiedad computada `hasProfessional = computed(() => ...)` que determine si la sede activa tiene habilitados los cursos profesionales.
*   Modificar el template del sidebar para que los acordeones y links con la propiedad `requiresProfessional` y `hasProfessional() === false` apliquen:
    *   Un estilo de opacidad atenuado (`opacity-50 pointer-events-none-ish`).
    *   Un icono de candado `🔒` al final.
*   Interceptar el click en enlaces bloqueados para desplegar un micro-drawer o un banner overlay de conmutación.

### Paso 3: Crear el `AjustesDrawerComponent`
*   Crear la carpeta `src/app/shared/components/ajustes-drawer` y el componente `AjustesDrawerComponent`.
*   Implementar un diseño premium con pestañas (Tabs):
    *   **Mi Perfil:** Formulario reactivo para nombre, RUT, email e inyección de cambio de contraseña.
    *   **Sitio Web:** Inyectar `WebsiteConfigFacade` para permitir la edición de la landing page en caliente.
    *   **Colaboradores:** Control administrativo de colaboradores/secretarias (inyecta `SecretariasFacade`).
    *   **Seguridad:** Logs de auditoría (inyecta `AuditoriaFacade`, exclusivo para administradores).
*   Garantizar el guardado reactivo por pestaña y la confirmación ante pérdida de cambios mediante `ConfirmModalService`.

---

## 3. Estrategia de Verificación

1.  **Validación de Compilación y Estilos:**
    *   Asegurar que la compilación de Angular pase sin errores.
    *   Verificar la correcta visualización de los candados y la atenuación.
2.  **Pruebas de Flujo de Conmutación:**
    *   Cambiar la sede activa a Clase B. Comprobar bloqueo y candados de Academia Profesional.
    *   Hacer clic en "Promociones" bloqueado. Comprobar banner de conmutación.
    *   Hacer clic en "Conmutar" y verificar cambio de sede a Profesional e ingreso automático a la vista.
3.  **Drawer de Ajustes:**
    *   Hacer clic en Ajustes desde el menú del avatar.
    *   Verificar que se abra el Drawer con las correspondientes pestañas y que los datos se carguen reactivamente.
