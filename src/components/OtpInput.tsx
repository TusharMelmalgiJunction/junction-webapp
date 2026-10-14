import { useRef } from 'react'

export function OtpInput({ value, onChange, invalid = false }: { value: string; onChange: (next: string) => void; invalid?: boolean }) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const digits = Array.from({ length: 4 }, (_, index) => value[index] || '')

  function update(index: number, digit: string) {
    const next = digits.map((item, itemIndex) => (itemIndex === index ? digit : item)).join('').slice(0, 4)
    onChange(next)
    if (digit && index < 3) refs.current[index + 1]?.focus()
  }

  return (
    <div className="otp">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => { refs.current[index] = node }}
          inputMode="numeric"
          maxLength={1}
          value={digit}
          aria-label={`Digit ${index + 1}`}
          style={invalid ? { borderColor: '#B3261E' } : undefined}
          onChange={(event) => update(index, event.target.value.replace(/\D/g, '').slice(-1))}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !digit && index > 0) refs.current[index - 1]?.focus()
          }}
        />
      ))}
    </div>
  )
}
