import { NextFunction, Request, Response } from 'express';

function jsonMetaDataMW(req: Request, res: Response, next: NextFunction) {
  const json = res.json;
  res.json = function (body) {
    const bodyWithMetaData = {
      response: body,
      metaData: {
        statusCode: res.statusCode,
        status: res.statusCode < 399 ? 'success' : 'failure',
        requestId: req.id,
      },
    };

    return json.call(this, bodyWithMetaData);
  };
  next();
}

export default jsonMetaDataMW;
