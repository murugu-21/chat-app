import { describe, expect, it } from 'vitest';
import {
    generateKeyPair,
    exportJWK,
    createLocalJWKSet,
    SignJWT,
} from 'jose';
import { makeVerifier } from './cognito.verifier.js';

const ISSUER = 'https://cognito-idp.us-east-1.amazonaws.com/pool_123';
const CLIENT_ID = 'client_abc';

async function setupCognito() {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const pubJwk = await exportJWK(publicKey);
    pubJwk.kid = 'test-key';
    pubJwk.alg = 'RS256';
    const jwks = createLocalJWKSet({ keys: [pubJwk] });
    const verify = makeVerifier({ mode: 'cognito', issuer: ISSUER, clientId: CLIENT_ID, jwks });

    const sign = (claims: Record<string, unknown>) =>
        new SignJWT(claims)
            .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
            .setIssuer(ISSUER)
            .setAudience(CLIENT_ID)
            .setSubject('sub-1')
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(privateKey);

    return { verify, sign };
}

describe('makeVerifier (cognito)', () => {
    it('accepts a valid id token and returns identity', async () => {
        const { verify, sign } = await setupCognito();
        const token = await sign({ token_use: 'id', email: 'a@b.com', email_verified: true });
        await expect(verify(token)).resolves.toEqual({
            email: 'a@b.com',
            emailVerified: true,
            sub: 'sub-1',
        });
    });

    it('rejects an access token (token_use !== id)', async () => {
        const { verify, sign } = await setupCognito();
        const token = await sign({ token_use: 'access' });
        await expect(verify(token)).rejects.toThrow();
    });

    it('rejects an id token missing the sub claim', async () => {
        const { publicKey, privateKey } = await generateKeyPair('RS256');
        const pubJwk = await exportJWK(publicKey);
        pubJwk.kid = 'test-key';
        pubJwk.alg = 'RS256';
        const jwks = createLocalJWKSet({ keys: [pubJwk] });
        const verify = makeVerifier({ mode: 'cognito', issuer: ISSUER, clientId: CLIENT_ID, jwks });
        const token = await new SignJWT({ token_use: 'id', email: 'a@b.com' })
            .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
            .setIssuer(ISSUER)
            .setAudience(CLIENT_ID)
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(privateKey);
        await expect(verify(token)).rejects.toThrow('token missing sub');
    });

    it('returns the picture claim when present', async () => {
        const { verify, sign } = await setupCognito();
        const token = await sign({ token_use: 'id', email: 'a@b.com', email_verified: true, picture: 'https://pic/x.png' });
        await expect(verify(token)).resolves.toMatchObject({ email: 'a@b.com', picture: 'https://pic/x.png' });
    });

    it('rejects a token with the wrong audience', async () => {
        const { publicKey, privateKey } = await generateKeyPair('RS256');
        const pubJwk = await exportJWK(publicKey);
        pubJwk.kid = 'test-key';
        pubJwk.alg = 'RS256';
        const jwks = createLocalJWKSet({ keys: [pubJwk] });
        const verify = makeVerifier({ mode: 'cognito', issuer: ISSUER, clientId: CLIENT_ID, jwks });
        const token = await new SignJWT({ token_use: 'id', email: 'a@b.com' })
            .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
            .setIssuer(ISSUER)
            .setAudience('some-other-client')
            .setSubject('sub-1')
            .setExpirationTime('5m')
            .sign(privateKey);
        await expect(verify(token)).rejects.toThrow();
    });
});

describe('makeVerifier (cognito) — missing vars', () => {
    it('throws when mode=cognito but issuer and clientId are missing', () => {
        expect(() => makeVerifier({ mode: 'cognito' })).toThrow(
            'cognito verifier requires issuer and clientId',
        );
    });
});

describe('makeVerifier (dev)', () => {
    const verify = makeVerifier({ mode: 'dev' });

    it('parses dev_<email>', async () => {
        await expect(verify('dev_alice@example.com')).resolves.toEqual({
            email: 'alice@example.com',
            emailVerified: true,
            sub: 'dev_alice@example.com',
        });
    });

    it('rejects a non-dev token', async () => {
        await expect(verify('garbage')).rejects.toThrow();
    });
});
