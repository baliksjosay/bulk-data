export const UGANDA_PHONE_COUNTRY_CODE = "+256";
export const UGANDA_PHONE_PREFIXES = ["77", "78", "79", "76", "39"] as const;
export const UGANDA_PHONE_PATTERN = /^\+256(77|78|79|76|39)\d{7}$/;
export const UGANDA_PHONE_PATTERN_SOURCE = "^\\+256(77|78|79|76|39)\\d{7}$";
export const UGANDA_PHONE_PLACEHOLDER = "+25677XXXXXXX";
export const UGANDA_PHONE_TITLE = "Use +256 followed by 77, 78, 79, 76, or 39 and 7 digits.";

const LOCAL_NUMBER_LENGTH = 9;

export function normalizeUgandaPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "");
  let localDigits = digits;

  if (localDigits.startsWith("256")) {
    localDigits = localDigits.slice(3);
  }

  if (localDigits.startsWith("0")) {
    localDigits = localDigits.slice(1);
  }

  return `${UGANDA_PHONE_COUNTRY_CODE}${localDigits.slice(0, LOCAL_NUMBER_LENGTH)}`;
}

export function isUgandaPhoneNumber(value: string) {
  return UGANDA_PHONE_PATTERN.test(value);
}

export function isPossibleUgandaPhoneInput(value: string) {
  if (!value.startsWith(UGANDA_PHONE_COUNTRY_CODE)) {
    return false;
  }

  const localDigits = value.slice(UGANDA_PHONE_COUNTRY_CODE.length);

  if (!/^\d{0,9}$/.test(localDigits)) {
    return false;
  }

  if (!localDigits) {
    return true;
  }

  return UGANDA_PHONE_PREFIXES.some(
    (prefix) => prefix.startsWith(localDigits) || localDigits.startsWith(prefix),
  );
}
