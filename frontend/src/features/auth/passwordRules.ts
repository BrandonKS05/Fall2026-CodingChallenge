/** The same rules the contract enforces, written so the form can show them as you type. */
export const PASSWORD_RULES = [
  { label: 'At least 10 characters', holds: (value: string) => value.length >= 10 },
  { label: 'A letter', holds: (value: string) => /[a-zA-Z]/.test(value) },
  { label: 'A number', holds: (value: string) => /[0-9]/.test(value) },
];
