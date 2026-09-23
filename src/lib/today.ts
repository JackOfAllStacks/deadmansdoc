// Today's date where the product runs (Victoria), as yyyy-mm-dd.
export function todayInMelbourne(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(now);
}

// "Monday 21 September", for a yyyy-mm-dd date with no time attached.
export function formatDay(date: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
