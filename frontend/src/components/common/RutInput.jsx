import React, { forwardRef } from 'react';
import { Input } from './Input.jsx';
import { formatRut } from '../../utils/rut.js';

/**
 * Campo de RUT: solo admite números y K (el resto se descarta al escribir o pegar)
 * y se formatea solo como 12.345.678-5. Compatible con react-hook-form (register).
 */
export const RutInput = forwardRef(function RutInput({ onChange, ...props }, ref) {
  const handleChange = (e) => {
    e.target.value = formatRut(e.target.value);
    onChange?.(e);
  };

  return (
    <Input
      ref={ref}
      inputMode="text"
      autoComplete="username"
      maxLength={12}
      {...props}
      onChange={handleChange}
    />
  );
});
