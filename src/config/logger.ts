import winston, { format } from "winston";
import { Logtail } from "@logtail/node";
import { LogtailTransport } from "@logtail/winston";

const { combine, timestamp, json, errors } = format;

export const logtail = new Logtail(process.env.SOURCE_TOKEN!, {
  endpoint: process.env.LOGTAIL_ENDPOINT!,
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(timestamp(), json(), errors({ stack: true })),
  transports: [new winston.transports.Console(), new LogtailTransport(logtail)],
  exceptionHandlers: [
    new winston.transports.Console(),
    new LogtailTransport(logtail),
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
    new LogtailTransport(logtail),
  ],
  defaultMeta: {
    service: "server-primary",
    env: process.env.NODE_ENV || "development",
  },
});
