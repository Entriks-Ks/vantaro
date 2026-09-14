import PhoneInput, { parsePhoneNumber } from 'react-phone-number-input';
import de from 'react-phone-number-input/locale/de';
import 'react-phone-number-input/style.css';

// ITU-T E.164 allows at most 15 digits (country code + subscriber number).
const E164_MAX_DIGITS = 15;

/**
 * Validates a phone number against the rules of its own country.
 * e.g. a +383 number is validated against Kosovo (XK) rules,
 *      a +49 number against Germany (DE) rules, etc.
 */
export function isValidMobile(value) {
  if (!value) return false;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length > E164_MAX_DIGITS) return false;
  try {
    const parsed = parsePhoneNumber(value);
    return parsed.isValid();
  } catch {
    return false;
  }
}

/**
 * Phone input with country selector.
 * Pass an `error` string (from the parent on submit) to show it below the field.
 * No error is shown while the user is still typing.
 */
export default function PhoneField({
  id = 'phone',
  value,
  onChange,
  disabled = false,
  required = false,
  className = '',
  defaultCountry = 'DE',
  error = '',
}) {
  return (
    <div className="vantaro-phone-field-wrapper">
      <PhoneInput
        id={id}
        international
        countryCallingCodeEditable={false}
        defaultCountry={defaultCountry}
        labels={de}
        value={value || undefined}
        onChange={(next) => onChange(next || '')}
        disabled={disabled}
        required={required}
        className={`vantaro-phone-input ${error ? 'vantaro-phone-input--error' : ''} ${className}`.trim()}
        numberInputProps={{
          name: 'phone',
          autoComplete: 'tel',
          required,
          disabled,
          placeholder: '151 23456789',
          'aria-invalid': Boolean(error),
          'aria-describedby': error ? `${id}-error` : undefined,
        }}
      />
      {error && (
        <span id={`${id}-error`} className="vantaro-phone-field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
