/**
 * Z-Index hierarchy for the application
 * Higher values appear on top of lower values
 *
 * MUI defaults for reference:
 * - Drawer: 1200
 * - Modal/Dialog: 1300
 * - Snackbar: 1400
 * - Tooltip: 1500
 */

export const Z_INDEX = {
  // Base layer: Side navigation and floating controls
  SIDE_NAVIGATION: 1200,
  FLOAT_NAVIGATION: 1300,
  ECONOMIC_CALENDAR_DRAWER: 1300,

  // AI drawer layer
  AI_DRAWER_BACKDROP: 1399,
  AI_DRAWER: 1400,

  // Economic calendar drawer when opened from a dialog (needs to be above the dialog)
  ECONOMIC_CALENDAR_DRAWER_OVER_DIALOG: 1550,

  // Between drawer and dialog (for overlays that need to be above drawer but below dialogs)
  ECONOMIC_CALENDAR_DETAIL: 1450,

  // Dialog layer (for modals/dialogs that open from AI drawer or other drawers)
  DIALOG: 1500,

  // Dialog popover layer (menus, date pickers, autocomplete dropdowns inside dialogs)
  DIALOG_POPUP: 1600,

  // Tooltip layer (tooltips inside dialogs need higher z-index)
  TOOLTIP: 1750,

  // Snackbar layer (notifications should appear above dialogs)
  SNACKBAR: 1700,

  // Rich text editor layer (needs to be above dialogs)
  RICH_TEXT_MENU: 2000,
  RICH_TEXT_DIALOG: 2100,

  // Top layer: Loading indicators, critical alerts
  LOADING_PROGRESS: 9999,
};
