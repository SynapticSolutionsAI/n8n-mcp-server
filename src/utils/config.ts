/**
 * Parses a flat object with dot-notation keys into a nested object.
 * @param query The object to parse (e.g., from req.query).
 * @returns A nested object.
 */
export function parseDotNotation(query: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key in query) {
    const value = query[key];
    const keys = key.split('.');
    let current = result;

    for (let i = 0; i < keys.length; i++) {
      const subKey = keys[i];
      if (i === keys.length - 1) {
        // Last key, assign value
        current[subKey] = value;
      } else {
        // Not the last key, create nested object if it doesn't exist
        if (!current[subKey] || typeof current[subKey] !== 'object') {
          current[subKey] = {};
        }
        current = current[subKey];
      }
    }
  }

  return result;
}
 