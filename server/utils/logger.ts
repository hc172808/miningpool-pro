import winston from 'winston';

// Create a logger instance with custom formatting
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(info => 
      `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
    )
  ),
  transports: [
    // Console output for all logs
    new winston.transports.Console(),
    
    // File output for error logs
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    
    // File output for all logs
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

// Add a simpler transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Create a stream object for Morgan HTTP request logging
export const logStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};