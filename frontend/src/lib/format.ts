export function formatUgx(value: number) {
  return `UGX ${value.toLocaleString("en-US")}`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-UG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Kampala",
  }).format(new Date(value));
}

export function sentenceCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatPaymentMethod(value: string) {
  if (value === "prn") {
    return "PRN";
  }

  if (value === "mobile_money") {
    return "Mobile Money";
  }

  if (value === "card") {
    return "Card";
  }

  return sentenceCase(value);
}
