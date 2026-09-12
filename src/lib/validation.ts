/**
 * Validation utilities for mobile-customer application.
 */

// Known file extensions that are NOT valid top-level domains
const BLOCKED_EMAIL_EXTENSIONS = new Set([
  'yml', 'yaml', 'xml', 'json', 'txt', 'csv', 'pdf', 'doc', 'docx', 'xls', 'xlsx',
  'ppt', 'pptx', 'exe', 'bin', 'apk', 'zip', 'rar', 'tar', 'gz', '7z', 'iso', 'dmg',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tif', 'tiff',
  'mp3', 'mp4', 'avi', 'mov', 'mkv', 'flv', 'wav', 'ogg',
  'js', 'ts', 'jsx', 'tsx', 'html', 'htm', 'css', 'scss', 'sass', 'less',
  'py', 'java', 'c', 'cpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt',
  'sh', 'bat', 'cmd', 'ps1', 'sql', 'env', 'log', 'conf', 'config', 'bak',
  'tmp', 'temp', 'old', 'swp', 'md', 'markdown', 'lock',
]);

// Well-known consumer email providers with their legitimate domain extensions
const COMMON_EMAIL_PROVIDERS: Record<string, string[]> = {
  gmail: ['com'],
  icloud: ['com'],
  rediffmail: ['com'],
  aol: ['com'],
  yahoo: ['com', 'in', 'co.in', 'co.uk', 'ca', 'fr', 'de', 'com.au'],
  outlook: ['com', 'in', 'co', 'co.uk', 'com.au'],
  hotmail: ['com', 'co.uk', 'fr', 'de', 'es', 'it'],
  zoho: ['com', 'in'],
  proton: ['me', 'com'],
  protonmail: ['com', 'ch'],
};

// Recognized generic and country-code top-level domains (IANA verified)
const KNOWN_TLDS = new Set([
  // Core generic TLDs
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'name', 'pro',
  // Modern popular gTLDs
  'app', 'dev', 'tech', 'io', 'ai', 'co', 'me', 'online', 'store', 'site', 'club',
  'shop', 'xyz', 'care', 'live', 'work', 'today', 'agency', 'global', 'cloud',
  'digital', 'world', 'space', 'group', 'design', 'media', 'life', 'solutions',
  'company', 'center', 'team', 'network', 'systems', 'services', 'expert', 'academy',
  'studio', 'email', 'link', 'click', 'news', 'one', 'city', 'zone', 'clothing',
  'cleaning', 'laundry', 'top', 'vip', 'fit', 'tv', 'cc', 'to', 'is', 'ch',
  // Country code TLDs (ccTLDs)
  'in', 'us', 'uk', 'ca', 'au', 'de', 'fr', 'jp', 'cn', 'sg', 'ae', 'sa', 'eu',
  'nl', 'es', 'it', 'ru', 'br', 'za', 'nz', 'se', 'no', 'fi', 'dk', 'be', 'at',
  'ie', 'pl', 'pt', 'gr', 'cz', 'ro', 'hu', 'kr', 'hk', 'tw', 'my', 'id', 'th',
  'vn', 'ph', 'pk', 'bd', 'lk', 'np', 'mx', 'ar', 'cl', 'pe', 'tr', 'eg', 'ng',
  'ke', 'il', 'ua', 'by', 'kz', 'uz', 'qa', 'kw', 'om', 'bh', 'lu', 'mt', 'cy'
]);

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates whether an email string is well-formed, contains a real domain,
 * has a valid recognized TLD, and is not a corrupted/typo address.
 */
export function validateEmail(email: string): EmailValidationResult {
  const trimmed = email.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Email address cannot be empty.' };
  }

  // Must not contain any whitespace
  if (/\s/.test(trimmed)) {
    return { isValid: false, error: 'Email cannot contain spaces.' };
  }

  // Must have exactly one @ symbol
  const atParts = trimmed.split('@');
  if (atParts.length === 1) {
    return { isValid: false, error: 'Email must contain an "@" symbol (e.g. name@gmail.com).' };
  }
  if (atParts.length > 2) {
    return { isValid: false, error: 'Email cannot contain multiple "@" symbols.' };
  }

  const [localPart, domainPart] = atParts;

  // Local part (username before @)
  if (!localPart || localPart.length > 64) {
    return { isValid: false, error: 'The email username before "@" is invalid or too long.' };
  }
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return { isValid: false, error: 'Email username cannot start, end, or contain consecutive dots.' };
  }
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)) {
    return { isValid: false, error: 'Email username contains invalid characters.' };
  }

  // Domain part (after @)
  if (!domainPart || domainPart.length > 255) {
    return { isValid: false, error: 'The email domain after "@" is missing or too long.' };
  }
  if (domainPart.startsWith('.') || domainPart.endsWith('.') || domainPart.includes('..')) {
    return { isValid: false, error: 'Email domain format is invalid.' };
  }

  const domainLabels = domainPart.split('.');
  if (domainLabels.length < 2) {
    return {
      isValid: false,
      error: 'Please include a domain extension (e.g. @gmail.com or @outlook.com).',
    };
  }

  // Validate each domain label
  for (const label of domainLabels) {
    if (!label || label.length > 63) {
      return { isValid: false, error: 'Email domain labels cannot be empty or exceed 63 characters.' };
    }
    if (label.startsWith('-') || label.endsWith('-')) {
      return { isValid: false, error: 'Email domain labels cannot start or end with a hyphen.' };
    }
    if (!/^[a-zA-Z0-9-]+$/.test(label)) {
      return { isValid: false, error: 'Email domain contains invalid characters.' };
    }
  }

  const provider = (domainLabels[0] || '').toLowerCase();
  const rawTld = domainLabels[domainLabels.length - 1];
  if (!rawTld) {
    return { isValid: false, error: 'Email domain extension is missing.' };
  }
  const tld = rawTld.toLowerCase();
  const fullExt = domainLabels.slice(1).join('.').toLowerCase();

  // 1. Check known email providers (e.g. gmail must end in .com, not .ghkljksd)
  if (COMMON_EMAIL_PROVIDERS[provider]) {
    const validExtensions = COMMON_EMAIL_PROVIDERS[provider];
    const matchesFull = validExtensions.includes(fullExt);
    const matchesTld = validExtensions.includes(tld);
    if (!matchesFull && !matchesTld) {
      const preferred = validExtensions[0];
      return {
        isValid: false,
        error: `Invalid domain extension for ${provider}. Did you mean @${provider}.${preferred}?`,
      };
    }
  }

  // 2. Reject file extensions and disallowed extensions
  if (BLOCKED_EMAIL_EXTENSIONS.has(tld)) {
    return {
      isValid: false,
      error: `".${tld}" is a file extension, not a valid email domain. Please use a valid email (e.g. name@gmail.com).`,
    };
  }

  // 3. TLD must only be alphabetic characters and between 2 and 12 chars
  if (!/^[a-zA-Z]{2,12}$/.test(tld)) {
    return {
      isValid: false,
      error: `Invalid domain extension ".${tld}". Top-level domain must be 2-12 letters.`,
    };
  }

  // 4. Real TLDs must contain at least one vowel (rejects consonant spam like "ghkljksd")
  if (!/[aeiouy]/.test(tld)) {
    return {
      isValid: false,
      error: `Invalid domain extension ".${tld}". Please enter a valid email address (e.g. name@gmail.com).`,
    };
  }

  // 5. Check against recognized TLD database
  if (!KNOWN_TLDS.has(tld)) {
    return {
      isValid: false,
      error: `Unrecognized domain extension ".${tld}". Please enter a valid email address (e.g. name@gmail.com).`,
    };
  }

  return { isValid: true };
}

/**
 * Quick boolean check for email validity.
 */
export function isValidEmail(email: string): boolean {
  return validateEmail(email).isValid;
}
