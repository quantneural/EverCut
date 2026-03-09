/**
 * Time-related utility functions.
 *
 * Centralises the AM/PM ↔ 24 h parsing logic that was previously
 * copy-pasted in 4+ controller files.
 */

/**
 * Parse a 12-hour time string ("hh:mm AM/PM") into total minutes since midnight.
 *
 * @param   {string}      timeStr – e.g. "02:30 PM"
 * @returns {number|null}           minutes since midnight, or null if unparseable
 */
export const parseTimeToMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;

    const parts = timeStr.trim().split(' ');
    if (parts.length !== 2) return null;

    const [timePart, meridiem] = parts;
    const [hoursStr, minutesStr] = timePart.split(':');

    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

    const upper = meridiem.toUpperCase();
    if (upper === 'PM' && hours !== 12) hours += 12;
    if (upper === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
};

/**
 * Check whether a booking time is in the future compared to "now".
 *
 * @param   {string}  dateStr  – ISO date, e.g. "2025-08-03"
 * @param   {string}  timeStr  – 12-hour time, e.g. "02:30 PM"
 * @param   {Date}    [now]    – override for testing
 * @returns {boolean}
 */
export const isBookingInFuture = (dateStr, timeStr, now = new Date()) => {
    const bookingMinutes = parseTimeToMinutes(timeStr);
    if (bookingMinutes === null) return false;

    const bookingDate = new Date(dateStr);
    const todayStr = now.toISOString().slice(0, 10);
    const bDateStr = bookingDate.toISOString().slice(0, 10);

    if (bDateStr > todayStr) return true;
    if (bDateStr < todayStr) return false;

    // Same day – compare minutes
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return bookingMinutes > currentMinutes;
};

/**
 * Check whether a time string falls within a shop's open/close window.
 * Expects openTime / closeTime in "HH:MM" 24-hour format.
 *
 * @param   {string}  timeStr   – 12-hour booking time "hh:mm AM/PM"
 * @param   {string}  openTime  – "09:00"
 * @param   {string}  closeTime – "21:00"
 * @returns {boolean}
 */
export const isWithinShopHours = (timeStr, openTime, closeTime) => {
    const bookingMin = parseTimeToMinutes(timeStr);
    if (bookingMin === null) return false;

    const [openH, openM] = openTime.split(':').map(Number);
    const [closeH, closeM] = closeTime.split(':').map(Number);

    const openMin = openH * 60 + openM;
    const closeMin = closeH * 60 + closeM;

    return bookingMin >= openMin && bookingMin < closeMin;
};

/**
 * Get the full weekday name for a given date string.
 *
 * @param   {string} dateStr – ISO date, e.g. "2025-08-03"
 * @returns {string}           e.g. "Sunday"
 */
export const getDayOfWeek = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' });
};

/**
 * Check if "now" is within `windowHours` before the appointment.
 *
 * @param   {Date}    appointmentDate
 * @param   {string}  appointmentTime – "hh:mm AM/PM"
 * @param   {number}  windowHours     – e.g. 2
 * @param   {Date}    [now]
 * @returns {boolean} true if we are WITHIN the blocking window (action not allowed)
 */
export const isWithinCancellationWindow = (
    appointmentDate,
    appointmentTime,
    windowHours,
    now = new Date(),
) => {
    const minutes = parseTimeToMinutes(appointmentTime);
    if (minutes === null) return false;

    const appt = new Date(appointmentDate);
    appt.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);

    const windowStart = new Date(appt.getTime() - windowHours * 60 * 60 * 1000);
    return now >= windowStart && now < appt;
};
