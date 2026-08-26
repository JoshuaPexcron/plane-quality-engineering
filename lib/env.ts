// Reads a required environment variable and fails loudly when it is missing,
// so a misconfigured .env shows up as one clear message instead of a vague 401.
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}, see .env.example`);
  return value;
}
