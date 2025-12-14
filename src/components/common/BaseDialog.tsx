import React, { ReactNode } from 'react';
import {
  Dialog,
  DialogProps,
  IconButton,
  Typography,
  Box,
  useTheme,
  Button,
  CircularProgress
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { dialogProps } from '../../styles/dialogStyles';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { Z_INDEX } from '../../styles/zIndex';
import {
  DialogTitleStyled,
  DialogContentStyled,
  DialogActionsStyled
} from '../StyledComponents';

export interface BaseDialogProps extends Omit<DialogProps, 'title'> {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  hideCloseButton?: boolean;
  hideFooterCancelButton?: boolean;
  cancelButtonText?: string;
  cancelButtonAction?: () => void;
  primaryButtonText?: string;
  primaryButtonAction?: (e?: React.FormEvent) => void;
  isSubmitting?: boolean;
  contentSx?: any;
}

const BaseDialog: React.FC<BaseDialogProps> = ({
  open,
  onClose,
  title,
  actions,
  children,
  maxWidth = 'sm',
  fullWidth = true,
  hideCloseButton = false,
  hideFooterCancelButton = false,
  cancelButtonText = 'Cancel',
  cancelButtonAction,
  primaryButtonText = 'Save',
  primaryButtonAction,
  isSubmitting = false,
  contentSx = {},
  ...rest
}) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      {...dialogProps}
      sx={{ zIndex: Z_INDEX.DIALOG }}
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            boxShadow: 'none',
            border: `1px solid ${theme.palette.divider}`,
            maxHeight: '90vh',
            overflow: 'hidden',
            '& .MuiDialogContent-root': {
              ...scrollbarStyles(theme)
            }
          }
        }
      }}
      {...rest}
    >
      <DialogTitleStyled>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          {typeof title === 'string' ? (
            <Typography variant="h6">{title}</Typography>
          ) : (
            title
          )}
        </Box>
        {!hideCloseButton && (
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitleStyled>

      <DialogContentStyled sx={contentSx}>
        {children}
      </DialogContentStyled>

      {(actions || !hideFooterCancelButton || primaryButtonAction) && (
        <DialogActionsStyled>
          
          <Box sx={{ display: 'flex', gap: 1 }}>

            {(!hideFooterCancelButton || cancelButtonAction) && (
              <Button
                variant="outlined"
                color="primary"
                onClick={cancelButtonAction || onClose}
              >
                {cancelButtonText}
              </Button>
            )}

            {actions}

            {primaryButtonAction && (
              <Button
                variant="contained"
                color="primary"
                onClick={primaryButtonAction}
                disabled={isSubmitting}
                sx={{
                  minWidth: '100px',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1
                }}
              >
                {primaryButtonText}
                {isSubmitting && (
                  <CircularProgress
                    size={16}
                    sx={{
                      position: 'static'
                    }}
                  />
                )}
              </Button>
            )}
          </Box>
        </DialogActionsStyled>
      )}
    </Dialog>
  );
};

export default BaseDialog;
