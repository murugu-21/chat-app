import jwt from 'jsonwebtoken';
import env from '../../config/env.js';

const signToken = (payload: Record<string, string>): string => {
    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '3600s' });
    return token;
};

export { signToken };
