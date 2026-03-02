# Product Vision — Autoescuela

## Frase Guía
> Toda la operación de tu escuela de conducción en una sola pantalla: matrículas, agenda, pagos y flota, sin Excel, sin papel, sin errores.

## El Problema

Las escuelas de conducción en Chile funcionan con Excel, papel y WhatsApp. La secretaria — quien sostiene la operación entera — pierde horas cada día cruzando planillas para saber si un instructor está libre, si el vehículo tiene la revisión técnica al día y si el alumno no tiene deuda pendiente antes de agendar una clase.

Ese cruce manual (el **"Triple Match"**: instructor + vehículo + alumno) es donde nacen los errores:
- Doble-booking de instructores
- Vehículos con SOAP vencido que siguen circulando
- Pagos perdidos entre cuadernos y transferencias sin conciliar
- Alumnos menores de 17 años matriculados sin autorización notarial

Mientras tanto, las boletas del SII se emiten en un sistema aparte, los cierres de caja se hacen a mano, y el dueño de la escuela no tiene visibilidad real del ingreso del día. Cada escuela reinventa su propio caos operativo con las mismas herramientas insuficientes.

## Para Quién Es (Target)

- **Primario — La secretaria:** Ejecuta más de 100 acciones diarias: matricula alumnos, agenda clases, cobra pagos, cuadra caja, imprime boletas y coordina instructores. Necesita hacer todo eso sin cambiar de sistema ni de pestaña. No es una persona técnica; valora que las cosas funcionen al primer intento.
- **Secundario — El administrador/dueño:** Necesita visibilidad financiera y operativa en tiempo real, control multi-sede, y la tranquilidad de que los procesos críticos (documentos vigentes, pagos registrados, normativa cumplida) están bajo control sin depender de WhatsApp.
- **Terciario — Instructores y alumnos:** Los instructores ven su agenda del día y firman fichas digitales. Los alumnos consultan sus clases, estado de cuenta y horarios disponibles.

## Cómo Debe Sentirse

Como el mejor día de trabajo de la secretaria: todo a la mano, sin sorpresas, sin tener que pensar dos veces.

- Matricula un alumno en 3 minutos con validaciones automáticas (RUT inválido, menor sin autorización, documentos faltantes).
- Agenda una clase arrastrando un bloque en el Gantt: el sistema ya verificó que instructor, vehículo y alumno están disponibles.
- Cobra y el pago queda registrado, conciliado y listo para el cierre de caja.

**No debe sentirse como "software empresarial".** Debe sentirse como una herramienta hecha por alguien que entendió exactamente cómo funciona una escuela de conductores en Chile.

## Principios de Producto

1. **La secretaria es la estrella.** Cada decisión de diseño se evalúa primero desde su flujo de trabajo. Si una funcionalidad le agrega un clic innecesario, está mal diseñada.
2. **Validar antes, no corregir después.** Prevenir errores en el punto de entrada (edad mínima, RUT, disponibilidad, documentos vencidos) en lugar de permitirlos y generar alertas retroactivas.
3. **Si el sistema puede calcularlo, no lo preguntes.** Horas restantes del alumno, disponibilidad del instructor, estado de deuda, vigencia del SOAP: todo dato derivable se calcula automáticamente.
4. **Especializado vence a genérico.** Cada pantalla y flujo existe porque resuelve un problema real de una escuela de conducción chilena. Sin funcionalidades "por si acaso".
5. **Visibilidad instantánea.** El estado actual de la operación (financiero, agenda, flota, alumnos) debe ser comprensible en menos de 5 segundos desde el dashboard.

## Anti-Goals (Lo que NO somos)

1. **No somos un CRM genérico.** Sin pipelines de venta, campañas de marketing ni leads. Gestionamos la operación desde que el alumno se matricula hasta que recibe su certificado.
2. **No somos un ERP.** Sin inventario general, compras ni contabilidad completa. Nuestro alcance financiero: pagos de alumnos, boletas SII y cuadratura de caja.
3. **No somos una plataforma de e-learning.** Las clases prácticas se agendan y registran, pero la enseñanza ocurre en el vehículo.
4. **No escalamos a otros verticales.** Somos software vertical para escuelas de conducción. Toda la profundidad del producto vive ahí.
5. **No reemplazamos al contador.** Generamos boletas y reportes operativos, pero la contabilidad formal sigue siendo responsabilidad del contador de la escuela.

## Dominio Central

### Entidades clave
- **Alumno** — datos personales, documentos, horas contratadas vs consumidas, estado de deuda
- **Instructor** — disponibilidad, licencias habilitadas, agenda
- **Vehículo** — SOAP, revisión técnica, permisos de circulación, disponibilidad
- **Clase** — el Triple Match (alumno + instructor + vehículo), tipo (práctica/teórica), estado
- **Matrícula** — contrato de servicio, plan de horas, documentos requeridos
- **Pago** — cobros, conciliación, boleta SII, cierre de caja

### El Triple Match (regla de negocio central)
Antes de confirmar una clase deben verificarse simultáneamente:
1. **Alumno disponible** — sin deuda bloqueante, horas restantes > 0, documentos vigentes
2. **Instructor disponible** — sin otra clase en ese horario, licencia habilitada para el tipo de clase
3. **Vehículo disponible** — sin otra clase en ese horario, SOAP y revisión técnica vigentes
