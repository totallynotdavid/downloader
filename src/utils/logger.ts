import {createLogger, format, transports, Logger} from 'winston';
import path from 'path';

const {combine, timestamp, printf, colorize, errors, splat} = format;

const customFormat = printf(({level, message, timestamp, stack, ...meta}) => {
    const baseMessage = stack || message;
    const metaString = meta && Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${level}]: ${baseMessage} ${metaString}`;
});

const logger: Logger = createLogger({
    level: 'info',
    format: combine(
        colorize(),
        timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
        errors({stack: true}),
        splat(),
        customFormat
    ),
    transports: [
        new transports.Console(),
        new transports.File({
            filename: path.join(__dirname, '../../logs/error.log'),
            level: 'error',
        }),
        new transports.File({
            filename: path.join(__dirname, '../../logs/combined.log'),
        }),
    ],
    exceptionHandlers: [
        new transports.Console(),
        new transports.File({filename: 'exceptions.log'}),
    ],
    rejectionHandlers: [
        new transports.Console(),
        new transports.File({filename: 'rejections.log'}),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(
        new transports.Console({
            format: combine(colorize(), customFormat),
        })
    );
}

export default logger;
