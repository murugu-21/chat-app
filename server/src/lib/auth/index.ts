import env from '../../config/env.js';
import { makeVerifier, type Verifier } from './cognito.verifier.js';

export const verifyToken: Verifier = makeVerifier({
    mode: env.AUTH_MODE,
    issuer: env.COGNITO_ISSUER,
    clientId: env.COGNITO_CLIENT_ID,
});
