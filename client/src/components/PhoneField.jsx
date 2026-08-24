import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import de from 'react-phone-number-input/locale/de';
import 'react-phone-number-input/style.css';

export function isValidMobile(value) {
  return Boolean(value && isValidPhoneNumber(value));
}

export default function PhoneField({
  id = 'phone',
  value,
  onChange,
  disabled = false,
  required = false,
  className = '',
  defaultCountry = 'DE',
}) {
  return (
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
      className={`vantaro-phone-input ${className}`.trim()}
      numberInputProps={{
        name: 'phone',
        autoComplete: 'tel',
        required,
        disabled,
        placeholder: '151 23456789',
      }}
    />
  );
}
