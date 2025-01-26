import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * A helper function that takes in classes and concatenates them
 * - Makes sure classes that come later override previous classes in order
 * - Makes sure classes only override whats needed minimum to make the override work
 * - Is a composition of clsx and twMerge
 * @param inputs - classes, can be strings
 * @returns a string of tailwind classes
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
