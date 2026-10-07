/** datetime-local has no timezone; display the browser's local clock, not UTC. */
export function toLocalDateTime(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function serializeEventDate(value, original) {
  // A minute-resolution control must not truncate an unchanged stored instant.
  const instant = original && toLocalDateTime(original) === value ? original : value;
  return new Date(instant).toISOString();
}

/** Preserve event instants when sending values edited on a local-clock form. */
export function serializeEventDates(form, original) {
  return {
    ...form,
    startDate: serializeEventDate(form.startDate, original?.startDate),
    endDate: form.endDate ? serializeEventDate(form.endDate, original?.endDate) : form.endDate,
  };
}
