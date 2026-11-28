import { useState, type InputHTMLAttributes } from 'react'

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

/** Campo de formulario reutilizado en Login/Registro/RecuperarContrasena. */
export function FormField({ label, id, type, ...inputProps }: FormFieldProps) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-on-surface">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && showPassword ? 'text' : type}
          {...inputProps}
          className={`w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-3 text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none ${isPassword ? 'pr-10' : ''}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3 text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="material-symbols-outlined text-[20px]">
              {showPassword ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
