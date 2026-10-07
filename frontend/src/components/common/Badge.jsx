import React from 'react';

export function Badge({ children, variant = 'neutral', icon: Icon, className = '' }) {
  const variantClass = `vtf-badge-${variant}`;

  return (
    <span className={`vtf-badge ${variantClass} ${className}`}>
      {Icon && <Icon size={12} />}
      <span>{children}</span>
    </span>
  );
}
