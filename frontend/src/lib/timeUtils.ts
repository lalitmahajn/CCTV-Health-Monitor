import { useState, useEffect, useCallback } from 'react';
import type { UptimePeriod } from './types';

export type TimeFormat = '12h' | '24h';

const STORAGE_KEY = 'cctv_time_format';
const EVENT_NAME = 'cctv_time_format_changed';

/**
 * Returns the currently active time format ('12h' | '24h').
 */
export function getTimeFormat(): TimeFormat {
  if (typeof window === 'undefined') return '12h';
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === '24h' ? '24h' : '12h';
}

/**
 * Sets the active time format and broadcasts an event to all components.
 */
export function setTimeFormat(format: TimeFormat): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, format);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: format }));
}

/**
 * React hook to read and update the active time format across the entire app.
 */
export function useTimeFormat(): [TimeFormat, (fmt: TimeFormat) => void] {
  const [format, setFormat] = useState<TimeFormat>(getTimeFormat);

  useEffect(() => {
    const handleUpdate = () => {
      setFormat(getTimeFormat());
    };
    window.addEventListener('storage', handleUpdate);
    window.addEventListener(EVENT_NAME, handleUpdate);
    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener(EVENT_NAME, handleUpdate);
    };
  }, []);

  const updateFormat = useCallback((next: TimeFormat) => {
    setFormat(next);
    setTimeFormat(next);
  }, []);

  return [format, updateFormat];
}


/**
 * Safely parses a Date from various formats, ensuring UTC strings without timezone suffixes
 * (like SQLite's 'YYYY-MM-DD HH:MM:SS') are properly parsed as UTC rather than naive local time.
 */
export function parseUtcDate(value: Date | string | number | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  let str = String(value).trim();
  if (!str) return null;

  // If string has date format YYYY-MM-DD HH:MM:SS and lacks timezone, normalize to ISO UTC
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a time value (Date, ISO string, or timestamp) according to the selected format.
 */
export function formatTime(
  value: Date | string | number | null | undefined,
  format: TimeFormat = getTimeFormat(),
  includeSeconds: boolean = false
): string {
  try {
    const d = parseUtcDate(value);
    if (!d) return value ? String(value) : '--';

    return d.toLocaleTimeString([], {
      hour: format === '12h' ? 'numeric' : '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: format === '12h',
    });
  } catch {
    return value ? String(value) : '--';
  }
}

/**
 * Formats a date and time string.
 */
export function formatDateTime(
  value: Date | string | number | null | undefined,
  format: TimeFormat = getTimeFormat()
): string {
  try {
    const d = parseUtcDate(value);
    if (!d) return value ? String(value) : '--';

    const datePart = d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timePart = formatTime(d, format, true);
    return `${datePart}, ${timePart}`;
  } catch {
    return value ? String(value) : '--';
  }
}

/**
 * Formats chart X-axis labels based on period and selected 12h/24h format.
 */
export function formatChartLabel(
  timestamp: string,
  period: UptimePeriod,
  format: TimeFormat = getTimeFormat()
): string {
  try {
    const d = parseUtcDate(timestamp);
    if (!d) return timestamp;

    if (period === '1h' || period === '6h' || period === '24h') {
      return d.toLocaleTimeString([], {
        hour: format === '12h' ? 'numeric' : '2-digit',
        minute: '2-digit',
        hour12: format === '12h',
      });
    }

    if (period === '7d') {
      const monthDay = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const time = d.toLocaleTimeString([], {
        hour: format === '12h' ? 'numeric' : '2-digit',
        minute: '2-digit',
        hour12: format === '12h',
      });
      return `${monthDay} ${time}`;
    }

    // 30d, 90d
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return timestamp;
  }
}

/**
 * Formats full detailed timestamp for chart tooltips.
 */
export function formatTooltipDateTime(
  timestamp: string,
  format: TimeFormat = getTimeFormat()
): string {
  return formatDateTime(timestamp, format);
}


/**
 * Detects client timezone information for regional settings display.
 */
export function getTimezoneInfo(): { name: string; offset: string } {
  try {
    const name = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
    const offsetMinutes = -new Date().getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absMinutes = Math.abs(offsetMinutes);
    const hours = String(Math.floor(absMinutes / 60)).padStart(2, '0');
    const mins = String(absMinutes % 60).padStart(2, '0');
    const offset = `UTC${sign}${hours}:${mins}`;
    return { name, offset };
  } catch {
    return { name: 'Local', offset: 'UTC' };
  }
}
