interface FormFieldProps {
  label: string;
  icon?: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string;
}

export function FormField({ label, icon, required, children, error }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        {icon && <span>{icon}</span>}
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
