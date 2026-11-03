import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** clsx + tailwind-merge, so a caller's class can override a default one. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))
