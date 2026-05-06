import * as XLSX from 'xlsx';

/**
 * Genera y descarga un archivo .xlsx en el navegador.
 * @param sheetName  Nombre de la pestaña
 * @param headers    Fila de encabezados
 * @param rows       Filas de datos
 * @param filename   Nombre del archivo sin extensión
 */
export function downloadExcel(
  sheetName: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  filename: string,
): void {
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
