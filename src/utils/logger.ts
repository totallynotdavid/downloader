import path from 'path';
import fs from 'fs';
import {createLogger, format, transports, Logger} from 'winston';
const {combine, timestamp, printf, errors, splat, json, colorize} = format;

const LOG_DIR = path.resolve(__dirname, '../../logs');

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, {recursive: true});
}

const LOG_LEVEL = 'info';

const customFormat = printf(({level, message, timestamp, stack, ...meta}) => {
    const baseMessage = stack || message;
    const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${level}]: ${baseMessage} ${metaString}`;
});

const loggerTransports = [
    new transports.Console({
        level: LOG_LEVEL,
        format: combine(
            colorize({all: true}),
            timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
            errors({stack: true}),
            splat(),
            customFormat
        ),
    }),

    new transports.File({
        filename: path.join(LOG_DIR, 'error.log'),
        level: 'error',
        format: combine(
            timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
            errors({stack: true}),
            splat(),
            json()
        ),
    }),

    new transports.File({
        filename: path.join(LOG_DIR, 'combined.log'),
        format: combine(
            timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
            errors({stack: true}),
            splat(),
            json()
        ),
    }),
];

const logger: Logger = createLogger({
    level: LOG_LEVEL,
    format: combine(
        timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
        errors({stack: true}),
        splat(),
        customFormat
    ),
    transports: loggerTransports,
    exceptionHandlers: [
        new transports.File({filename: path.join(LOG_DIR, 'exceptions.log')}),
    ],
    rejectionHandlers: [
        new transports.File({filename: path.join(LOG_DIR, 'rejections.log')}),
    ],
    exitOnError: false,
});

export default logger;
