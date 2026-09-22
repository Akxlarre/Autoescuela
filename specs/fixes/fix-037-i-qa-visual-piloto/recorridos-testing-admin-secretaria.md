RECORRIDOS DE TESTING — PILOTO ADMIN / SECRETARIA
Autoescuela — Fase de pruebas antes de entrega
14 sep 2026

Nota: los recorridos marcados con (*) tocan lógica multi-sede/RLS — puntos históricamente
delicados del proyecto. Probarlos con más cuidado, idealmente con secretaria@test.com y
secretaria2@test.com (sedes distintas) para confirmar que no se mezclan datos entre sedes.


BLOQUE A — ALUMNOS Y MATRÍCULA

1. Matricular alumno nuevo Clase B (wizard completo: datos personales, instructor y
   horario, documentos, pago, contrato, confirmación con número de matrícula).
2. Matricular alumno nuevo Profesional (A2/A3/A4/A5) — validar que precio y requisitos
   de licencia cambien según la categoría elegida.
3. Editar ficha de un alumno existente (datos personales, ver progreso y clases).
4. Archivar y restaurar un alumno (papelera) — probar en Clase B y en Profesional.
5. Ex-alumnos: revisar filtros y re-matricular a alguien desde ahí.
6. Pre-inscritos (Profesional): convertir un pre-inscrito en matrícula completa.
7. Reagendar clases penalizadas (2 inasistencias consecutivas) — flujo de 2 pasos.
8. Reprogramar una clase individual ya agendada.
9. Justificar una inasistencia y confirmar que deja de contar para la penalización.
10. Generar el carnet o certificado PDF de un alumno Clase B con curso terminado.
11. (*) Un alumno matriculado en la sede X no debe aparecer en la lista de la
    secretaria de la sede Y.


BLOQUE B — OPERACIÓN DIARIA

1. Agenda semanal: navegar entre semanas, filtrar por instructor, abrir un slot
   ocupado y uno disponible, revisar advertencia de documento de vehículo vencido.
2. Asistencia: iniciar clase (KM inicial) y finalizarla (KM final + firma del
   alumno y del instructor).
3. Marcar una inasistencia y justificarla.
4. Servicios especiales: registrar una venta, agregar un servicio nuevo al
   catálogo, desactivar uno, y probar borrar una venta de un día con caja ya
   cerrada (debe bloquearlo).
5. Certificación Clase B: generar certificados pendientes y enviarlos de forma
   masiva.
6. Documentos (DMS): subir documento de alumno, de instructor, institucional y
   una plantilla; verlos en preview; eliminar uno.
7. Flota: revisar disponibilidad diaria de vehículos, registrar un
   mantenimiento, confirmar alertas de documentos por vencer/vencidos.
8. (*) Un vehículo marcado "ambas sedes" debe verse en las dos; uno de una sola
   sede no debe aparecer en la otra.


BLOQUE C — DINERO Y ADMINISTRACIÓN

1. Registrar un pago (efectivo y transferencia) sobre una matrícula con saldo
   pendiente.
2. Revisar pagos recientes y el listado de deudores.
3. Cuadratura diaria: registrar un ingreso y un egreso, cerrar la caja, y
   confirmar que después del cierre no se puedan agregar más movimientos a
   ese día.
4. Reportes contables: filtrar por mes y por sede, verificar que los números
   cuadren con la cuadratura del punto anterior.
5. Historial de cuadraturas: revisar un cierre pasado.
6. Liquidaciones de instructores: generar una y revisar el desglose.
7. Cursos singulares: crear un curso, editar su precio, inscribir a un alumno
   y cobrarle.
8. Instructores: crear uno, editarlo, invitarlo por correo, asignarle un
   vehículo.
9. Secretarias: crear una, otorgarle/quitarle el acceso "ambas sedes".
10. Usuarios: gestión general de roles.
11. Auditoría: después de un pago, un cierre de caja y un alumno archivado
    (pasos anteriores), confirmar que las 3 acciones queden en el log con el
    usuario correcto.
12. Configuración Web: editar algo del sitio público y verificar que se
    refleje en la landing real.
13. (*) Reportes de una secretaria muestran solo su sede; Admin en "Todas las
    sedes" suma el total correcto.
