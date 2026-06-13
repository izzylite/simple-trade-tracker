import { useIsMobile } from 'hooks/useResponsive';

/**
 * Paper sx that turns any MUI `<Dialog>` edge-to-edge on a phone. Spread this
 * LAST into the dialog's paper sx (after the dialog's own paperSx) so it wins.
 *
 * `BaseDialog` already bakes this in; this helper is for the handful of dialogs
 * that render a RAW `<Dialog>` and can't easily migrate to BaseDialog.
 */
export const FULLSCREEN_PAPER_SX = {
  maxHeight: '100%',
  height: '100%',
  width: '100%',
  maxWidth: '100%',
  m: 0,
  borderRadius: 0,
  border: 'none',
} as const;

/** Safe-area padding values for a full-screen dialog's header / footer. */
export const SAFE_AREA_TOP = 'max(14px, env(safe-area-inset-top))';
export const SAFE_AREA_BOTTOM = 'max(12px, env(safe-area-inset-bottom))';

/**
 * For raw `<Dialog>` components that don't use BaseDialog. Returns the
 * `fullScreen` flag (true on phones, <600px) and the paper sx extension to
 * merge so the dialog renders edge-to-edge with no rounded corners on phones.
 *
 * Usage:
 *   const { fullScreen, fullScreenPaperSx } = useFullScreenDialog();
 *   <Dialog
 *     fullScreen={fullScreen}
 *     slotProps={{ paper: { sx: { ...paperSx, ...fullScreenPaperSx } } }}
 *   />
 */
export function useFullScreenDialog() {
  const fullScreen = useIsMobile();
  return {
    fullScreen,
    fullScreenPaperSx: fullScreen ? FULLSCREEN_PAPER_SX : undefined,
  } as const;
}
