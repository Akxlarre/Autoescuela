# Reunión Demo — Revisión Completa del Sistema
**Fecha:** 2026-05-29  
**Participantes:** Dueño (revisor), equipo de desarrollo  
**Objetivo:** Recorrer todos los módulos del sistema y recoger feedback del dueño

---

## Estado general
El dueño validó el sistema en términos generales. Aprobó los flujos principales sin objeciones mayores. Se anotaron correcciones puntuales y pendientes abiertos que requieren reuniones específicas.

---

## Módulos revisados y su estado

### Dashboard
- ✅ KPIs, alertas y botones rápidos aprobados
- ✅ Alerta de pago atrasado, documentos por vencer confirmados como necesarios

### Matrícula (Clase B)
- ✅ Flujo completo aprobado: datos → clases → horario → documentos → pago → contrato → carnet
- ✅ Selector de 6 o 12 clases para controlar cuántas fechas puede elegir el alumno
- ✅ Descuento libre en paso de pago (igual a las "promociones" del sistema anterior)
- ✅ Contrato generado automáticamente, descargable e imprimible
- 🔲 **Pendiente menor:** opción "bloque" para asignar todas las clases al mismo slot horario de una sola vez (actualmente se escoge clase por clase). No es bloqueante.
- **Límite de clases por día confirmado:**
  - Regulación oficial: máximo 1 clase de 45 min/día
  - Matrícula online (alumno): máximo 1 clase/día. Si necesita más → ir a sede
  - Matrícula en sede (secretaria): hasta 3 clases/día. Más de 3 → agenda manual el resto al día siguiente

### Agenda semanal
- ✅ Diseño es borrador, se perfeccionará. La lógica (calendario por instructor) aprobada.
- ✅ Diferenciación por instructor, ver horario y con qué alumno

### Asistencia (Clase B)
- ✅ La secretaria inicia y finaliza la clase → reemplaza la app anterior
- ✅ Al iniciar: actualiza kilometraje, puede cambiar vehículo, agrega nota del instructor
- ✅ Zoom: agendar clase teórica con link, lista de invitados = lista de asistencia → la secretaria marca en tiempo real

### Pagos
- ✅ Registro de pago (alumno, concepto, monto, método, referencia)
- ✅ Exportar a PDF/Excel con filtro por rango de fechas
- ✅ Historial de todos los pagos recientes

### Cuadratura de caja
- ✅ Ingresos automáticos (matrículas, cuotas) + ingreso manual para casos que no entren automáticamente
- ✅ Egreso manual libre (gasoline, útiles, desayuno, anticipos, etc.)
- ✅ Arqueo de billetes al cierre (para quien use caja chica). Si no hay caja chica → empieza en 0, sin problema
- ✅ Historial de cierres (ver quién cerró, a qué hora, resultado)
- 🐛 **Bug visual confirmado:** desde la última actualización, el contenido de la cuadratura ocupa demasiado espacio horizontal y debería estar más a la izquierda. Arreglo fácil, pendiente.
- **Distinción de egresos en cuadratura (dueño confirmó):**
  - Van en cuadratura (secretaria los registra): gasoline, útiles de aseo/oficina, anticipos a instructores, gastos varios pequeños (incluso 50k si es algo común)
  - NO van en cuadratura (solo en reportes, solo el dueño): choques/reparaciones mayores, luz, agua, arriendo, contribuciones, sueldos
  - La regla es: si es un gasto del día a día operacional → cuadratura. Si es estructural o irregular de monto grande → reportes del dueño

### Reportes contables
- ✅ Vista mensual de ingresos y egresos por categoría aprobada
- 🔲 **Pendiente (nuevo requerimiento):** El dueño necesita una sección privada para registrar egresos estructurales (arriendo, luz, agua, sueldos, choques). Esto alimenta el **punto de equilibrio**: ingresos del mes − egresos totales = ganancia neta. Solo visible para admin.

### Base de alumnos
- ✅ Separación activos / ex-alumnos aprobada
- ✅ Papelera (soft delete) aprobada — evita corromper cuadratura con eliminaciones directas
- ✅ En perfil del alumno: estado del certificado, número, fecha de entrega como prueba ante reclamos

### Gestión de certificados
- ✅ Número de certificado, fecha de entrega, archivo subido = prueba legal de entrega

### Personal (secretarias, instructores)
- ✅ Crear secretaria / instructor igual que flotas
- ✅ Ver horario de instructor, descargable

### Flota
- ✅ Estado de vehículo, historial de mantenciones, costo promedio mensual, kilómetros
- ✅ Registrar servicio (tipo, kilometraje, costo, detalle)

### Servicios especiales
- ✅ Crear servicio con precio base → registrar venta a cliente externo → queda en cuadratura

### Cursos singulares
- ✅ Siguen siendo válidos — SENCE los crea aunque se eliminó la franquicia tributaria

### Repositorio de documentos
- ✅ Subir escaneos → quedan guardados permanentemente
- ✅ Plantillas descargables (instructivos, pruebas, etc.)

---

## Clase Profesional

### Relatores
- ✅ Especialidades: A2, A3, A4, A5
- ✅ Convalidaciones: A2 → A4, A5 → A3
- ✅ Un relator puede estar en múltiples promociones simultáneamente

### Promociones
- ✅ Múltiples categorías de alumnos dentro de la misma promoción
- ✅ Integrar desertor a una promoción posterior → aprobado
- ✅ KPIs por categoría dentro de la promoción (cuántos son A2, cuántos A4, etc.)

### Libro de clase
- ✅ Mantener texto "firma diaria" (no "semanal") — así está en el Excel original y así debe quedar
- ✅ Profesores, módulos, asistencia, calendario, evaluaciones
- ✅ Exportable a PDF (reemplaza libro físico impreso)

### Evaluaciones
- 🔲 **Corrección:** Cambiar "nota" numérica por **"concepto"**
  - Los alumnos no pueden ser reprobados porque ya pagaron el certificado
  - Usar términos como: "rendido satisfactoriamente", "rendido parcialmente" (definir exactamente con el dueño)
- 🔲 **Pendiente (requiere reunión específica):** Las pruebas escritas se envían por correo y llegan respondidas. No está claro cómo integrar este flujo al sistema. No implementar hasta definir.

### Asistencia clase profesional
- ✅ Firma semanal (aunque el libro diga "diaria")
- ✅ Separado en teórica y práctica

---

## Pendientes abiertos (requieren definición)

| # | Módulo | Descripción | Prioridad |
|---|--------|-------------|-----------|
| 1 | Reportes | Crear sección de egresos estructurales (solo admin) para punto de equilibrio | Alta |
| 2 | Cuadratura | Fix bug visual (contenido demasiado expandido horizontalmente) | Media |
| 3 | Clase profesional | Reunión específica sobre el flujo de pruebas escritas por email | Media |
| 4 | Evaluaciones | Definir términos exactos de "concepto" con el dueño | Media |
| 5 | Matrícula | Opción de horario "bloque" (todas las clases al mismo slot) | Baja |

---

## Próxima reunión sugerida
- Reunión con la **secretaria** para obtener su punto de vista operativo
- Reunión específica para el **flujo de pruebas escritas** de clase profesional
