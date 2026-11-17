import {clsx} from "clsx";
import {twMerge} from "tailwind-merge";

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export function getPodiumMedal(rank) {
    return ["gold", "silver", "bronze"][rank - 1];
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
 * Robustly parse a datetime input string (local YYYY-MM-DDTHH:mm, ISO, or Date)
 * assuming IST (+05:30) when no timezone is specified.
 */
export function parseISTDateTime(dateTimeInput) {
    if (!dateTimeInput) return null;
    if (dateTimeInput instanceof Date) return isNaN(dateTimeInput.getTime()) ? null : dateTimeInput;
    const str = String(dateTimeInput).trim();
    if (!str) return null;
    if (str.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(str)) {
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str)) {
        const d = new Date(str + ":00+05:30");
        return isNaN(d.getTime()) ? null : d;
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(str)) {
        const d = new Date(str + "+05:30");
        return isNaN(d.getTime()) ? null : d;
    }
    const fallback = new Date(str);
    return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Add specified minutes to an IST datetime string or Date and return updated IST datetime-local string
 */
export function addMinutesToISTDateTime(dateTimeInput, minutes) {
    const baseDate = parseISTDateTime(dateTimeInput) || new Date();
    const newDate = new Date(baseDate.getTime() + minutes * 60000);
    return toISTDateTimeLocal(newDate);
}

/**
 * Convert a datetime-local input value to ISO string with IST offset
 * Used when sending times to the backend
 */
export function toISTISOString(dateTimeLocal) {
    const parsed = parseISTDateTime(dateTimeLocal);
    if (!parsed) return null;
    return parsed.toISOString();
}

/**
 * Convert a UTC date to IST datetime-local format for input fields
 */
export function toISTDateTimeLocal(utcDate) {
    if (!utcDate) return "";
    const date = new Date(utcDate);
    if (Number.isNaN(date.getTime())) return "";
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
