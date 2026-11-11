import { validateToken } from "./auth/session.js";

export function handler(req) {
  return validateToken(req.headers.authorization);
}