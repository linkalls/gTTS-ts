import { createLogger, format, transports } from "winston";

const logger = createLogger({
    level: 'warn',
    format: format.combine(
        format.timestamp(),
        format.printf(({ level, message }) => {
            return `gtts - ${level.toUpperCase()} - ${message}`;
        })
    ),
    transports: [new transports.Console()]
});

export default logger;
