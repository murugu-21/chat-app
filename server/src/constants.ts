import env from "./config/env.js";

const corsList = [
    env.NODE_ENV === 'prod'
        ? /^https:\/\/[a-zA-Z0-9-]*\.d2v9syk4m83jg4.amplifyapp.com$/
        : /^http[s]?:\/\/localhost:\d{4}$/,
];

export { corsList }
