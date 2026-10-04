import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCameraDisplayName(camera?: { name?: string; alias?: string | null } | null): string {
  if (!camera) return '';
  if (camera.alias && camera.alias.trim()) {
    return camera.alias.trim();
  }
  return camera.name || 'Unnamed Camera';
}

