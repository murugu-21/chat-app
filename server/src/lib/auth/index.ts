import env from '../../config/env.js';
import { makeVerifier, type Verifier } from './cognito.verifier.js';

if (env.NODE_ENV === 'prod' && env.AUTH_MODE === 'dev') {
    throw new Error('AUTH_MODE=dev is forbidden when NODE_ENV=prod');
}

export const verifyToken: Verifier = makeVerifier({
    mode: env.AUTH_MODE,
    issuer: env.COGNITO_ISSUER,
    clientId: env.COGNITO_CLIENT_ID,
});
