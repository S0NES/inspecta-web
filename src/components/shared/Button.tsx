import React from 'react';
import './Button.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) => {
  return (
    <button
      className={`btn btn--${variant} btn--${size} ${className}`}
      {...props}
    />
  );
};

export const IconButton: React.FC<ButtonProps> = ({
  variant = 'ghost',
  size = 'md',
  className = '',
  ...props
}) => {
  return (
    <button
      className={`btn btn--icon btn--${variant} btn--${size} ${className}`}
      {...props}
    />
  );
};
