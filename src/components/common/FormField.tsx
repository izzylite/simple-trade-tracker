import React, { JSX, ReactNode } from 'react';
import { 
  TextField, 
  TextFieldProps, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  SelectProps,
  Autocomplete,
  AutocompleteProps,
  Box,
  Typography
} from '@mui/material';

// Text Field
interface TextInputProps extends Omit<TextFieldProps, 'label'> {
  label: string;
  helperText?: string;
}

export const TextInput: React.FC<TextInputProps> = ({ 
  label, 
  helperText,
  ...rest 
}) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <TextField
        label={label}
        variant="outlined"
        fullWidth
        size="small"
        {...rest}
      />
      {helperText && (
        <Typography variant="caption" color="text.secondary">
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

// Select Field
interface SelectInputProps extends Omit<SelectProps, 'label'> {
  label: string;
  options: Array<{ value: string | number; label: string }>;
  helperText?: string;
}

export const SelectInput: React.FC<SelectInputProps> = ({ 
  label, 
  options, 
  helperText,
  ...rest 
}) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <FormControl fullWidth size="small">
        <InputLabel>{label}</InputLabel>
        <Select
          label={label}
          {...rest}
        >
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {helperText && (
        <Typography variant="caption" color="text.secondary">
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

// Autocomplete Field
interface AutocompleteInputProps<T> extends Omit<AutocompleteProps<T, boolean, boolean, boolean>, 'renderInput'> {
  label: string;
  helperText?: string;
  textFieldProps?: Partial<TextFieldProps>;
}

export function AutocompleteInput<T>({ 
  label, 
  helperText,
  textFieldProps,
  ...rest 
}: AutocompleteInputProps<T>): JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Autocomplete
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            size="small"
            {...textFieldProps}
          />
        )}
        {...rest}
      />
      {helperText && (
        <Typography variant="caption" color="text.secondary">
          {helperText}
        </Typography>
      )}
    </Box>
  );
}

// Form Section
interface FormSectionProps {
  title?: string;
  children: ReactNode;
}

export const FormSection: React.FC<FormSectionProps> = ({ title, children }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {title && (
        <Typography variant="subtitle1" fontWeight="bold">
          {title}
        </Typography>
      )}
      {children}
    </Box>
  );
};

// Form Row (for horizontal layout)
interface FormRowProps {
  children: ReactNode;
  spacing?: number;
}

export const FormRow: React.FC<FormRowProps> = ({ children, spacing = 2 }) => {
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: { xs: 'column', sm: 'row' }, 
      gap: spacing,
      '& > *': { flex: 1 }
    }}>
      {children}
    </Box>
  );
};

// Form Actions
interface FormActionsProps {
  children: ReactNode;
  align?: 'left' | 'center' | 'right';
  spacing?: number;
}

export const FormActions: React.FC<FormActionsProps> = ({ 
  children, 
  align = 'right',
  spacing = 1 
}) => {
  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: align === 'left' ? 'flex-start' : align === 'center' ? 'center' : 'flex-end',
      gap: spacing,
      mt: 2
    }}>
      {children}
    </Box>
  );
};
