const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrWithPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a rupee amount in Indian digit grouping, e.g. ₹1,25,000 */
export function formatINR(amount: number, withPaise = false) {
  return (withPaise ? inrWithPaise : inr).format(amount);
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDateIST(date: Date | string | number) {
  return dateFormatter.format(new Date(date));
}

/** Current date/time in Asia/Kolkata as a Date-like readable string */
export function todayIST() {
  return dateFormatter.format(new Date());
}
