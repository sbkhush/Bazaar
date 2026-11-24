export const DUPLICATE_CNIC_ERROR_MESSAGE =
  'This CNIC is already associated with a registered SB Khush shop. Only one shop can be registered against one CNIC. Please contact SB Khush Support if you believe this is an error.';

export const CNIC_AUDIT_BLOCK_MESSAGE =
  'Your existing SB Khush shop account has a pending CNIC verification audit. Please contact SB Khush Support or complete CNIC verification before registering another store.';

export function normalizeCnic(input: string): string {
  return String(input || '').replace(/\D/g, '').slice(0, 13);
}

export function formatCnicInput(input: string): string {
  const digits = normalizeCnic(input);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
}

export function isValidCnic(input: string): {
  valid: boolean;
  normalized: string;
  formatted: string;
  error?: string;
} {
  const normalized = normalizeCnic(input);
  const formatted = formatCnicInput(normalized);

  if (!normalized) {
    return {
      valid: false,
      normalized,
      formatted,
      error: 'CNIC number is required (13 digits in XXXXX-XXXXXXX-X format).',
    };
  }

  if (!/^\d{13}$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      formatted,
      error: 'Please enter a valid 13-digit Pakistani CNIC (e.g. 35202-1234567-1).',
    };
  }

  // Reject trivially fake all-same-digit sequences such as 0000000000000 or 1111111111111
  if (/^(\d)\1{12}$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      formatted,
      error: 'Please enter a genuine 13-digit CNIC number.',
    };
  }

  return {
    valid: true,
    normalized,
    formatted,
  };
}

export function maskCnic(input?: string): string {
  const digits = normalizeCnic(input || '');
  if (digits.length !== 13) return '';
  return `XXXXX-XXXX${digits.slice(9, 12)}-${digits.slice(12, 13)}`;
}
