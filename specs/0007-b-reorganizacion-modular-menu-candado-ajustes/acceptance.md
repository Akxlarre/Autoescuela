# Criterios de Aceptación — Spec 0007-b

Los siguientes criterios deben verificarse empíricamente antes de dar por cerrada esta especificación.

## Criterios Clave

- [ ] **CA1: Ocultamiento de Rutas Administrativas del Sidebar**
  - Al iniciar sesión con cualquier rol (Admin o Secretaria), las rutas `/configuracion-web`, `/secretarias`, `/usuarios` y `/auditoria` ya no figuran en el menú lateral.
  
- [ ] **CA2: Atenuación y Candados de Sede (Academia Profesional)**
  - Al seleccionar una sucursal no profesional (ej: **Autoescuela Chillán** / Clase B), la sección completa de **Academia Profesional** en el sidebar se renderiza al 50% de opacidad y muestra iconos de candado `🔒` al lado de los títulos.

- [ ] **CA3: Flujo de Conmutación Rápida (Click en Candado) y Autorización Multisede (RF-013)**
  - Al hacer clic en un enlace bloqueado con candado en la Academia Profesional, la navegación se interrumpe y se despliega un panel informativo.
  - Si el usuario cuenta con permiso multisede activo: El botón de "Conmutar sede" está habilitado, cambia la sede activa del sistema al instante y navega al módulo solicitado.
  - Si el usuario es una secretaria fija sin privilegios multisede: El botón se renderiza deshabilitado o despliega una advertencia "Acceso Denegado: Su cuenta no está autorizada para conmutar a esta sucursal".

- [ ] **CA4: Apertura y Operabilidad del Drawer de Ajustes y Restricciones de Seguridad**
  - Al hacer clic en "Ajustes" o "Mi Perfil" desde el panel del usuario, se despliega el cajón lateral derecho en pila.
  - Las pestañas permiten guardar cambios de forma independiente y se valida que cambios sucios (estado `dirty = true`) disparen el modal `ConfirmModalService` al intentar cerrar sin guardar.
  - Si el rol activo es "Secretaria": El tab "Seguridad / Logs de Auditoría" no existe en el DOM (removido físicamente del HTML).
