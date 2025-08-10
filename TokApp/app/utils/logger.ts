// Logger utility for consistent logging across the app
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

interface LogEntry {
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
  timestamp: string;
}

class Logger {
  private static instance: Logger;
  private isDevelopment = __DEV__;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatLog(entry: LogEntry): string {
    const { level, component, message, data, timestamp } = entry;
    let logString = `[${timestamp}] [${level}] [${component}] ${message}`;
    
    if (data !== undefined) {
      logString += ` ${JSON.stringify(data, null, 2)}`;
    }
    
    return logString;
  }

  private log(level: LogLevel, component: string, message: string, data?: any) {
    const entry: LogEntry = {
      level,
      component,
      message,
      data,
      timestamp: new Date().toISOString()
    };

    const formattedLog = this.formatLog(entry);

    switch (level) {
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.log(formattedLog);
        }
        break;
      case LogLevel.INFO:
        console.log(formattedLog);
        break;
      case LogLevel.WARN:
        console.warn(formattedLog);
        break;
      case LogLevel.ERROR:
        console.error(formattedLog);
        break;
    }

    // In production, you might want to send logs to a service
    if (!this.isDevelopment && level === LogLevel.ERROR) {
      this.sendToLoggingService(entry);
    }
  }

  private sendToLoggingService(entry: LogEntry) {
    // TODO: Implement sending logs to external service (e.g., Sentry, LogRocket)
    // This is a placeholder for production logging
  }

  debug(component: string, message: string, data?: any) {
    this.log(LogLevel.DEBUG, component, message, data);
  }

  info(component: string, message: string, data?: any) {
    this.log(LogLevel.INFO, component, message, data);
  }

  warn(component: string, message: string, data?: any) {
    this.log(LogLevel.WARN, component, message, data);
  }

  error(component: string, message: string, data?: any) {
    this.log(LogLevel.ERROR, component, message, data);
  }

  // Convenience methods for common logging patterns
  apiCall(component: string, endpoint: string, method: string, data?: any) {
    this.info(component, `API ${method} call to ${endpoint}`, data);
  }

  apiResponse(component: string, endpoint: string, status: number, data?: any) {
    this.info(component, `API response from ${endpoint}`, { status, data });
  }

  userAction(component: string, action: string, data?: any) {
    this.info(component, `User action: ${action}`, data);
  }

  validation(component: string, field: string, isValid: boolean, details?: any) {
    this.debug(component, `Validation for ${field}`, { isValid, details });
  }

  navigation(component: string, from: string, to: string) {
    this.info(component, `Navigation`, { from, to });
  }
}

export const logger = Logger.getInstance();
export default logger;
