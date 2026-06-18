import env from './config/env.js';

const corsList = [
    env.NODE_ENV === 'prod'
        ? 'https://chat.murugappan.dev'
        : /^http[s]?:\/\/localhost:\d{4}$/,
];

export { corsList };
