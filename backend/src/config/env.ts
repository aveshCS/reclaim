import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform(v => v === 'true' || v === '1');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// or postgresql:// URL'),
    /** Signs access tokens. At least 32 characters; generate with a password manager. */
    JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
    /** OAuth client ids allowed as the ID token audience (the Web client id, comma-separated). */
    GOOGLE_CLIENT_IDS: z.string().default(''),
    /**
     * Browser origins allowed to call the API. The mobile app doesn't need CORS, so it is
     * OFF unless this is set; there is no accidental "allow everything".
     */
    ALLOWED_ORIGINS: z.string().optional(),
    DOCS_ENABLED: bool.optional(),
    /** Behind Render/Railway's proxy, so rate limits see the real client address. */
    TRUST_PROXY: bool.optional(),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(120),
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(10),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV === 'production' && e.GOOGLE_CLIENT_IDS.trim() === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['GOOGLE_CLIENT_IDS'],
        message: 'is required in production',
      });
    }
  });

export type Env = Omit<
  z.infer<typeof EnvSchema>,
  'GOOGLE_CLIENT_IDS' | 'ALLOWED_ORIGINS' | 'DOCS_ENABLED' | 'TRUST_PROXY'
> & {
  googleClientIds: string[];
  allowedOrigins: string[];
  docsEnabled: boolean;
  trustProxy: boolean;
};

/** Reads and checks the environment once at startup. Fails fast with a clear message. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join('\n')}`);
  }
  const e = parsed.data;
  const list = (s?: string) =>
    (s ?? '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);
  const { GOOGLE_CLIENT_IDS, ALLOWED_ORIGINS, DOCS_ENABLED, TRUST_PROXY, ...rest } = e;
  return {
    ...rest,
    googleClientIds: list(GOOGLE_CLIENT_IDS),
    allowedOrigins: list(ALLOWED_ORIGINS),
    docsEnabled: DOCS_ENABLED ?? e.NODE_ENV !== 'production',
    trustProxy: TRUST_PROXY ?? e.NODE_ENV === 'production',
  };
}

export const ENV = Symbol('ENV');
