# Spec 0051-b — Flota para la secretaria, limitada a su sede

> **Status:** draft
> **Created:** 2026-10-12
> **Owner:** Benjamín
> **Priority:** P2 (no bloquea el piloto; hoy el admin hace todo lo de Flota)

---

## 1. Contexto de negocio

**Origen:** `ASG-i-032` (checklist 032, casos A04, R01 y R03; sospecha S17). **Decisión del owner
(2026-10-12):** la secretaria debe tener Flota, limitada a su sede. Reemplaza la decisión anterior
del mismo día ("la secretaria no tiene Flota en el piloto; se le quita la sugerencia de la búsqueda").

### Cómo está hoy (leído en el código y en la BD el 2026-10-12)

- **Menú y rutas:** Flota existe solo para el admin (`/app/admin/flota` y
  `/app/admin/flota/:id/mantenimientos`). La secretaria no tiene entrada de menú ni ruta.
- **Búsqueda global:** a la secretaria le sugiere "Flota Vehicular" (y hay un acceso rápido "Flota")
  que la manda a `/app/secretaria/flota`, que no existe (S17).
- **Código:** `FlotaFacade` ya resuelve la sede con `resolveBranchScope()`: a una secretaria sin grant
  multi-sede le trae los vehículos de su sede más los "Ambas". El listado es un componente
  compartido (`app-flota-list-content`) con `basePath` configurable.
- **Permisos en la BD (RLS):**

| Tabla | Leer | Crear | Editar | Borrar |
|---|---|---|---|---|
| `vehicles` | admin, secretaria (**todas las sedes**), instructor | admin; secretaria **solo su sede y no "Ambas"** | igual que crear | admin |
| `vehicle_documents` | admin, secretaria, instructor | **solo admin** | **solo admin** | admin |
| `maintenance_records` | admin, secretaria | **solo admin** | **solo admin** | admin |
| `vehicle_assignments` | admin, secretaria | solo admin | solo admin | admin |

Es decir: la BD ya la deja crear y editar vehículos de su sede, pero **no** cargar documentos ni
registrar mantenimientos, que es justo lo que más se hace en Flota día a día.

## 2. User Stories

- Como **secretaria**, quiero ver los vehículos de mi sede con sus documentos, kilometraje y
  mantenimientos, para saber qué está por vencer sin preguntarle al admin.
- Como **secretaria**, quiero renovar un documento (SOAP, revisión técnica, permiso) y registrar un
  mantenimiento de un vehículo de mi sede, para dejarlo al día cuando ocurre.
- Como **admin**, quiero que la secretaria no pueda modificar vehículos de la otra sede ni los
  compartidos ("Ambas").

## 3. Propuesta (a validar; ver §6)

1. **Menú y rutas:** entrada "Flota" en el menú de la secretaria; rutas `/app/secretaria/flota` y
   `/app/secretaria/flota/:id/mantenimientos`, reutilizando las pantallas y drawers que usa el admin.
2. **Alcance por sede:** ve los vehículos de **su sede** y los **"Ambas"**. Con grant multi-sede, las
   dos sedes (igual que en el resto de la app).
3. **Qué puede hacer en un vehículo de su sede:** crear, editar la ficha, cambiar el estado, cargar y
   renovar documentos, registrar y editar mantenimientos, ver la agenda e imprimir la Hoja de Ruta.
4. **Vehículos "Ambas":** los ve, pero **solo lectura** (ficha, documentos y mantenimientos). Tampoco
   puede marcar un vehículo como "Ambas" ni cambiarlo de sede: eso sigue siendo del admin.
5. **Asignar instructor:** sin cambios (se hace desde Instructores).
6. **Lo que la interfaz no deja, la BD tampoco:** se amplían las policies de `vehicle_documents` y
   `maintenance_records` (y la del bucket de archivos) para la secretaria, con la misma regla que ya
   tiene `vehicles`: solo vehículos de su sede y que no sean "Ambas".
7. **Búsqueda global:** con la ruta creada, la sugerencia "Flota Vehicular" deja de estar rota (S17).

## 4. Acceptance Criteria

- **AC1 — Menú y acceso:** Given una secretaria, When abre el menú, Then ve "Flota" y al entrar ve
  solo los vehículos de su sede y los "Ambas".
- **AC2 — No ve la otra sede:** Given una secretaria de la sede A sin grant, Then ningún vehículo
  exclusivo de la sede B aparece en su listado, ni entrando por URL a su página de mantenimientos.
- **AC3 — Opera en su sede:** en un vehículo de su sede puede crear, editar, cargar un documento y
  registrar un mantenimiento, y queda guardado.
- **AC4 — "Ambas" en solo lectura:** en un vehículo "Ambas" no tiene los botones de editar, cargar
  documento ni registrar mantenimiento; y si lo intenta por fuera de la pantalla, la BD lo rechaza.
- **AC5 — La otra sede, cerrada en la BD:** con su sesión no puede crear ni modificar documentos ni
  mantenimientos de un vehículo de la otra sede.
- **AC6 — Sin "Ambas" ni cambio de sede:** el formulario de la secretaria no ofrece "Ambas sedes" ni
  otra sede que la suya (salvo grant multi-sede).
- **AC7 — Búsqueda global:** buscar "flota", "soap" o "patente" como secretaria lleva a una pantalla
  que existe.
- **AC8 — El admin no cambia:** las pantallas y permisos del admin quedan igual.
- **AC-E1 — Auditoría:** lo que haga la secretaria en Flota queda en Auditoría a su nombre.
- **AC-E2 — Multi-sede con grant:** una secretaria con grant ve y opera las dos sedes como hoy en el
  resto de la app; los "Ambas" siguen en solo lectura para ella.

## 5. Fuera de alcance

- Restringir en la BD la **lectura** de vehículos de otras sedes (hoy puede leerlos todos). El listado
  ya la limita a su sede; cerrar la lectura por RLS afecta a la Agenda y a Asistencia, que muestran
  la patente de vehículos de instructores "Ambas". Queda como mejora aparte si se pide.
- Eliminar vehículos, documentos o mantenimientos (sigue siendo solo del admin).
- Asignar o quitar instructores de un vehículo.

## 6. Preguntas abiertas (decisión del owner)

1. **¿Puede cargar documentos y registrar mantenimientos**, o solo ver? Recomendado: sí puede, en
   vehículos de su sede (punto 3). Sin eso, Flota le serviría solo para mirar.
2. **¿Puede crear vehículos nuevos?** La BD ya lo permite. Recomendado: sí, en su sede.
3. **Vehículos "Ambas":** ¿solo lectura (recomendado) o también puede cargarles documentos y
   mantenimientos?
