/**
 * Generate URL-friendly slug from text
 *
 * @param text - Text to slugify
 * @returns Slugified string
 *
 * @example
 * slugify('Morning Yoga Flow') // 'morning-yoga-flow'
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replaceAll(/\s+/g, '-') // Replace spaces with -
    .replaceAll(/[^\w\-]+/g, '') // Remove all non-word chars
    .replaceAll(/\-\-+/g, '-') // Replace multiple - with single -
    .replaceAll(/^-+/, '') // Trim - from start of text
    .replaceAll(/-+$/, ''); // Trim - from end of text
}
