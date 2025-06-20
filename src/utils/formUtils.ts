import { useState, ChangeEvent } from 'react';

/**
 * Custom hook for managing form state
 * @param initialValues Initial form values
 * @returns Form state and handlers
 */
export function useForm<T extends Record<string, any>>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  // Handle text input change
  const handleChange = (e: ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    if (name) {
      setValues({
        ...values,
        [name]: value
      });
    }
  };

  // Handle number input change
  const handleNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name) {
      // Allow empty string or valid numbers
      if (value === '' || !isNaN(Number(value))) {
        setValues({
          ...values,
          [name]: value
        });
      }
    }
  };

  // Handle checkbox change
  const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    if (name) {
      setValues({
        ...values,
        [name]: checked
      });
    }
  };

  // Handle select change
  const handleSelectChange = (e: ChangeEvent<{ name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    if (name) {
      setValues({
        ...values,
        [name]: value
      });
    }
  };

  // Set a specific field value
  const setFieldValue = (field: keyof T, value: any) => {
    setValues({
      ...values,
      [field]: value
    });
  };

  // Set multiple field values
  const setFieldValues = (newValues: Partial<T>) => {
    setValues({
      ...values,
      ...newValues
    });
  };

  // Mark a field as touched
  const setFieldTouched = (field: keyof T, isTouched: boolean = true) => {
    setTouched({
      ...touched,
      [field]: isTouched
    });
  };

  // Set an error for a field
  const setFieldError = (field: keyof T, error: string | undefined) => {
    setErrors({
      ...errors,
      [field]: error
    });
  };

  // Reset the form
  const resetForm = (newValues?: T) => {
    setValues(newValues || initialValues);
    setErrors({});
    setTouched({});
  };

  // Validate the form
  const validateForm = (validationSchema: Record<keyof T, (value: any) => string | undefined>) => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let isValid = true;

    Object.keys(validationSchema).forEach((key) => {
      const error = validationSchema[key as keyof T](values[key as keyof T]);
      if (error) {
        newErrors[key as keyof T] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  return {
    values,
    errors,
    touched,
    handleChange,
    handleNumberChange,
    handleCheckboxChange,
    handleSelectChange,
    setFieldValue,
    setFieldValues,
    setFieldTouched,
    setFieldError,
    resetForm,
    validateForm
  };
}
