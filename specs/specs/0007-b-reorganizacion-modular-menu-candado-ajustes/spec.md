# Spec 0007-b — reorganizacion-modular-menu-candado-ajustes

> **Status:** approved
> **Created:** 2026-05-26
> **Owner:** Akxlarre
> **Priority:** P0

---

## 1. Contexto de negocio

**Origen:** Iniciativa interna — auditoría de experiencia de usuario y arquitectura operacional (módulos y menús).

**Persona afectada:** Secretaria (operador principal, realiza más de 100 acciones diarias) e Instructor/Relator/Admin (interfaz administrativa de control).

**Problema que resuelve:**
Hoy en día, el sidebar lateral de navegación para los roles de **Admin** y **Secretaria** está sumamente congestionado (24 rutas activas para el Admin y 22 para la Secretaria). Esta sobrecarga visual mezcla herramientas de alta frecuencia operativa (Agenda, Matrículas, Pagos) con configuraciones de bajísima frecuencia (Configuración Web, Gestión de Secretarias, Auditoría). 

Esto causa tres problemas críticos de negocio:
1.  **Alta fatiga cognitiva:** La secretaria pasa horas buscando rutas operacionales básicas.
2.  **Inconsistencia de Sede:** Si opera bajo una sede B2C (Autoescuela Clase B), las opciones de la escuela Profesional siguen expuestas y habilitadas, induciendo a errores de digitación en la sucursal incorrecta.
3.  **Desorden de Roles y Seguridad:** Tareas de administración y logs de seguridad están expuestas como elementos de primer nivel, en lugar de estar resguardadas en las opciones de usuario.

**Hipótesis de valor:**
Reorganizar la plataforma en **5 Hubs Operativos cotidianos colapsables**, implementar un **selector con "candado" interactivo** para deshabilitar las opciones profesionales en sucursales B2C, y **drenar la configuración estática** a un **Drawer de Ajustes Multicapa** reducirá los tiempos de flujo diario de la secretaria y eliminará a cero los errores por registro en la sede incorrecta.

---

## 2. User Stories

- **US1**: Como Secretaria, quiero que el menú lateral esté agrupado de forma lógica y colapsable por áreas operacionales para no abrumarme visualmente durante mi jornada.
- **US2**: Como Operador en una sucursal B2C (Clase B), quiero que los módulos profesionales de la otra sucursal se muestren bloqueados con un candado `🔒` y atenuados al 50% para saber claramente qué funciones no están disponibles en mi contexto actual.
- **US3**: Como Operador que hace clic en una opción con candado, quiero ver un banner explicativo inmediato con la opción de "conmutar sede" con un solo clic para no quedar en un callejón sin salida (dead end).
- **US4**: Como Administrador o Secretaria, quiero acceder a la configuración de la Landing Web, la creación de colaboradores y los logs de seguridad desde mi menú de usuario (avatar) a través de un Panel de Ajustes lateral integrado, sin perder de vista mi pantalla operacional de fondo.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given un usuario inicia sesión en una sede Clase B, When visualiza el sidebar, Then el acordeón "Academia Profesional" y sus sub-enlaces se renderizan al 50% de opacidad y con un icono de candado `🔒`.
- **AC2**: Given un usuario hace clic en un enlace bloqueado con candado, When se gatilla la interacción, Then el sistema interrumpe la navegación por defecto y despliega un overlay de sugerencia de conmutación de sede. Al presionar "Conmutar", la sede activa cambia y se carga el módulo seleccionado.
- **AC3**: Given un usuario hace clic en "Ajustes" desde el menú del avatar, When se procesa la acción, Then se abre un `LayoutDrawer` lateral derecho que carga el `AjustesDrawerComponent` con pestañas para Mi Perfil, Sitio Web, Colaboradores, Seguridad y Configuración Global, permitiendo editar en caliente sin recargar la app.
- **AC4**: Given un admin abre el panel de colaboradores en Ajustes, When crea una secretaria o revisa logs de seguridad, Then el formulario se gestiona dentro del Drawer y la grilla de fondo del dashboard se desplaza suavemente un 10% a la izquierda (GSAP layout-shift) para mantener la legibilidad.

### Edge cases obligatorios

- **AC-E1**: Given un admin con permisos "Todas las escuelas" (sede activa = null / todas), When ve el sidebar, Then todos los módulos de "Academia Profesional" y "Clase B" se muestran habilitados (sin candado), ya que tiene el contexto global de supervisión.
- **AC-E2**: Given un usuario con el rol de "secretaria" abre el Panel de Ajustes, When se procesa la visualización del panel, Then la pestaña de "Seguridad / Logs de Auditoría" se oculta por completo del DOM y no es accesible, previniendo visualizaciones no autorizadas de logs de seguridad.
- **AC-E3**: Given un drawer de Ajustes abierto con cambios sin guardar (estado `dirty = true`), When el usuario intenta hacer clic en el backdrop de fondo, fuera del panel, o presiona la tecla Escape, Then el sistema interrumpe el cierre automático y despliega el diálogo imperativo de confirmación de salida (`ConfirmModalService`) advirtiendo sobre la pérdida de datos.
- **AC-E4**: Given una secretaria intenta hacer clic en el botón "Conmutar Sede" de un módulo bloqueado con candado, When se gatilla la acción, Then el sistema verifica si la secretaria cuenta con la autorización multisede habilitada (RF-013); si cuenta con ella, realiza la conmutación al instante; de lo contrario, muestra una alerta flotante de "Acceso Denegado: Su cuenta no está autorizada para conmutar a esta sucursal" y bloquea la operación.

---

## 4. Out of scope

- ❌ Re-diseño de las bases de datos de Supabase. Esta spec solo altera la UI y la lógica de organización de rutas.
- ❌ Refactor de los portales de Alumno, Instructor y Relator. Sus menús se mantienen operando según sus especificaciones correspondientes.

---

## 5. Dependencias

### Specs previas
- Ninguna.

### Capacidades existentes
- `MenuConfigService` con computed signals reactivas al rol actual del usuario.
- `BranchFacade` para determinar la sucursal seleccionada.
- `LayoutDrawerFacadeService` para el renderizado dinámico de drawers en pila.
- `ConfirmModalService` para diálogos imperativos.

---

## 6. Datos y modelo (preliminar)

No se requiere alterar esquemas SQL. Sin embargo, en el frontend:
*   `NavItem` agrega:
    ```typescript
    requiresProfessional?: boolean;
    ```
*   `NavGroup` agrega:
    ```typescript
    collapsible?: boolean;
    isCollapsed?: boolean;
    ```

---

## 7. UX y flujos (preliminar)

*   **Menú Lateral:** Reducción de 24 ítems planos a 5 acordeones colapsables animados con GSAP (`addPillHovers`).
*   **Ajustes Drawer:** Interface limpia con tabs verticales que consume en memoria `WebsiteConfigFacade` y `SecretariasFacade`.
