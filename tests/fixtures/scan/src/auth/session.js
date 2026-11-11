export function validateToken(value) {
  return Boolean(value && value.length >= 16);
}