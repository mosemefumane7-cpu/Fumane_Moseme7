require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const apiRoutes = require('./routes');
const { startDatabaseMonitor, closePool, getDatabaseStatus } = require('./config/db');
const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');

const app = express();
const port = Number.parseInt(process.env.PORT || '3000', 10);
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);

app.disable('x-powered-by');
app.use(helmet({ frameguard: false, contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());
app.use(requestLogger);

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    service: 'batloung-farm-distribution',
    database: getDatabaseStatus(),
    timestamp: new Date().toISOString()
  });
});
app.use('/api', apiRoutes);
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
app.use(notFound);
app.use(errorHandler);

const server = app.listen(port, '0.0.0.0', () => {
  logger.info(`Batloung API listening on 0.0.0.0:${port}`);
  void startDatabaseMonitor();
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason instanceof Error ? reason : new Error(String(reason)));
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception; shutting down safely', error);
  server.close(() => {
    void closePool().finally(() => process.exit(1));
  });
  setTimeout(() => process.exit(1), 10000).unref();
});

const shutdown = (signal) => {
  logger.info(`${signal} received; closing server`);
  server.close(() => void closePool().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server };
