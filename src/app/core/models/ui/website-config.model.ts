/**
 * Modelos de UI para la configuración del sitio web público.
 *
 * SiteData se re-exporta tal cual desde el DTO porque la vista lo consume
 * sin transformación (regla models.md: no crear modelos de UI por burocracia).
 * La capa de componentes importa desde aquí — nunca desde dto/.
 */
export type { SiteData } from '@core/models/dto/website-config.model';
