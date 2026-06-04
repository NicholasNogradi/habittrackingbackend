import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import {
  tokenRequestSchema,
  refreshTokenSchema,
  revokeTokenSchema,
  registerSchema,
} from '../schemas/auth.schema.js';
import {
  createToken,
  refreshToken,
  revokeToken,
  register,
} from '../controllers/auth.controller.js';

export const authRouter = Router();

// Public endpoints — no requireAuth.
authRouter.post('/register', validateBody(registerSchema), register);
authRouter.post('/token', validateBody(tokenRequestSchema), createToken);
authRouter.post('/token/refresh', validateBody(refreshTokenSchema), refreshToken);
authRouter.post('/token/revoke', validateBody(revokeTokenSchema), revokeToken);
