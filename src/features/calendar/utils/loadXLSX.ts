/**
 * Lazy loader for the xlsx library (~600KB). Use this anywhere a .xlsx
 * file is parsed or written so the cost is paid only on the first
 * Excel-touching action of a session — and only once (the dynamic
 * import is cached by the bundler).
 */
export const loadXLSX = () => import('xlsx');
