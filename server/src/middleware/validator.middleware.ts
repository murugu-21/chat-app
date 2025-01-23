import { RequestHandler, Request, Response, NextFunction } from 'express';
import { ZodRawShape, ZodObject } from 'zod';

type ValidateOn = 'params' | 'query' | 'body';

const validatorMW =
    <T extends ZodRawShape>({
        validator,
        validateOn,
    }: {
        validator: ZodObject<T>;
        validateOn: ValidateOn;
    }): RequestHandler =>
    (req: Request, res: Response, next: NextFunction) => {
        const data = validator.parse(req[validateOn]);
        req[validateOn] = data;
        next();
    };

export { validatorMW, ValidateOn };
