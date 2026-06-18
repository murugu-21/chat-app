import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export type VerifiedIdentity = {
    email: string;
    emailVerified: boolean;
    sub: string;
};

export type Verifier = (token: string) => Promise<VerifiedIdentity>;

export const makeVerifier = (opts: {
    mode: 'dev' | 'cognito';
    issuer?: string;
    clientId?: string;
    jwks?: JWTVerifyGetKey;
}): Verifier => {
    if (opts.mode === 'dev') {
        return async (token: string) => {
            if (!token || !token.startsWith('dev_')) {
                throw new Error('invalid dev token');
            }
            const email = token.slice('dev_'.length);
            if (!email) throw new Error('invalid dev token');
            return { email, emailVerified: true, sub: `dev_${email}` };
        };
    }

    if (!opts.issuer || !opts.clientId) {
        throw new Error('cognito verifier requires issuer and clientId');
    }
    const issuer = opts.issuer;
    const clientId = opts.clientId;
    const jwks =
        opts.jwks ?? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

    return async (token: string) => {
        const { payload } = await jwtVerify(token, jwks, {
            issuer,
            audience: clientId,
        });
        if (payload.token_use !== 'id') {
            throw new Error('expected an id token');
        }
        const email = payload.email as string | undefined;
        if (!email) throw new Error('token missing email');
        return {
            email,
            emailVerified: payload.email_verified === true,
            sub: String(payload.sub),
        };
    };
};
