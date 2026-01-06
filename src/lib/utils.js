import {clsx} from "clsx";
import {twMerge} from "tailwind-merge";

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// IST Timezone utilities - all times displayed in India Standard Time
const IST_TIMEZONE = "Asia/Kolkata";

/**
 * Format a date to IST time string (HH:MM format)
 */
export function formatTimeIST(date) {
    if (!date) return "";
    return new Date(date).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: IST_TIMEZONE,
    });
}

/**
 * Format a date to full IST datetime string
 */
export function formatDateTimeIST(date) {
    if (!date) return "";
    return new Date(date).toLocaleString("en-IN", {
        timeZone: IST_TIMEZONE,
    });
}

/**
 * Format a date to IST date string
 */
export function formatDateIST(date) {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-IN", {
        timeZone: IST_TIMEZONE,
    });
}

/**
 * Convert a datetime-local input value to ISO string with IST offset
 * Used when sending times to the backend
 */
export function toISTISOString(dateTimeLocal) {
    if (!dateTimeLocal) return null;
    // Append IST offset (+05:30) to the datetime-local value
    return new Date(dateTimeLocal + ":00+05:30").toISOString();
}

/**
 * Convert a UTC date to IST datetime-local format for input fields
 */
export function toISTDateTimeLocal(utcDate) {
    if (!utcDate) return "";
    const date = new Date(utcDate);
    return date
        .toLocaleString("sv-SE", {
            timeZone: IST_TIMEZONE,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        })
        .replace(" ", "T");
}

/**
 * Get current time as IST datetime-local string
 */
export function getCurrentISTDateTimeLocal() {
    return toISTDateTimeLocal(new Date());
}
