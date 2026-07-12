/**
 * Tier de layout derivado del ancho REAL del contenedor `<main>` (layoutmain),
 * no del viewport: el layout-drawer angosta <main> sin cambiar la ventana.
 * Umbrales espejo de los breakpoints del bento grid ($bp-sm=640, $bp-lg=1024).
 */
export type LayoutTier = 'mobile' | 'tablet' | 'desktop';
