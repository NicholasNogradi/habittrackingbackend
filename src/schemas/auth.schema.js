import { z } from 'zod';

// The /auth/token endpoint accepts form-encoded or JSON. We validate the union
// of fields and enforce per-grant requirements with refine().
export const tokenRequestSchema = z
  .object({
    grant_type: z.enum(['password', 'authorization_code', 'client_credentials']),
    username: z.string().email().optional(),
    password: z.string().optional(),
    code: z.string().optional(),
    redirect_uri: z.string().url().optional(),
    client_id: z.string().optional(),
    client_secret: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.grant_type === 'password') {
      if (!val.username)
        ctx.addIssue({ code: 'custom', path: ['username'], message: 'required for password grant' });
      if (!val.password)
        ctx.addIssue({ code: 'custom', path: ['password'], message: 'required for password grant' });
    }
    if (val.grant_type === 'authorization_code') {
      if (!val.code)
        ctx.addIssue({ code: 'custom', path: ['code'], message: 'required for authorization_code grant' });
      if (!val.redirect_uri)
        ctx.addIssue({ code: 'custom', path: ['redirect_uri'], message: 'required for authorization_code grant' });
    }
    if (val.grant_type === 'client_credentials') {
      if (!val.client_id)
        ctx.addIssue({ code: 'custom', path: ['client_id'], message: 'required for client_credentials grant' });
      if (!val.client_secret)
        ctx.addIssue({ code: 'custom', path: ['client_secret'], message: 'required for client_credentials grant' });
    }
  });

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1),
});

export const revokeTokenSchema = z.object({
  refresh_token: z.string().min(1),
});

// Convenience registration schema (not in the OpenAPI doc, but needed to create users).
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'must be at least 8 characters'),
  displayName: z.string().min(1).max(100),
  timezone: z.string().optional(),
  locale: z.string().optional(),
});
