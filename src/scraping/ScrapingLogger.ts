import { writeFile, appendFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Log levels for scraping activities
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  component: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Configuration for the scraping logger
 */
export interface LoggerConfig {
  logLevel: LogLevel;
  logToConsole: boolean;
  logToFile: boolean;
  logDirectory: string;
  maxFileSize: number; // in bytes
  maxFiles: number;
  includeMetadata: boolean;
  dateFormat: string;
}

/**
 * Comprehensive logging system for scraping activities
 */
export class ScrapingLogger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private currentLogFile: string | null = null;

  private static readonly LOG_LEVELS = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
    [LogLevel.FATAL]: 4,
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      logLevel: LogLevel.INFO,
      logToConsole: true,
      logToFile: true,
      logDirectory: "./logs",
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      includeMetadata: true,
      dateFormat: "YYYY-MM-DD HH:mm:ss.SSS",
      ...config,
    };

    this.initializeLogger();
  }

  /**
   * Initialize the logger
   */
  private async initializeLogger(): Promise<void> {
    try {
      // Create log directory if it doesn't exist
      if (this.config.logToFile && !existsSync(this.config.logDirectory)) {
        await mkdir(this.config.logDirectory, { recursive: true });
      }

      // Set up periodic log flushing
      this.flushTimer = setInterval(() => {
        this.flushLogs();
      }, 5000); // Flush every 5 seconds

      this.info("ScrapingLogger initialized", "ScrapingLogger");
    } catch (error) {
      console.error("Failed to initialize ScrapingLogger:", error);
    }
  }

  /**
   * Log a debug message
   */
  debug(
    message: string,
    component: string,
    metadata?: Record<string, any>,
  ): void {
    this.log(LogLevel.DEBUG, message, component, metadata);
  }

  /**
   * Log an info message
   */
  info(
    message: string,
    component: string,
    metadata?: Record<string, any>,
  ): void {
    this.log(LogLevel.INFO, message, component, metadata);
  }

  /**
   * Log a warning message
   */
  warn(
    message: string,
    component: string,
    metadata?: Record<string, any>,
  ): void {
    this.log(LogLevel.WARN, message, component, metadata);
  }

  /**
   * Log an error message
   */
  error(
    message: string,
    component: string,
    error?: Error,
    metadata?: Record<string, any>,
  ): void {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.ERROR,
      message,
      component,
      metadata: this.config.includeMetadata ? metadata : undefined,
    };

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    this.addLogEntry(logEntry);
  }

  /**
   * Log a fatal error message
   */
  fatal(
    message: string,
    component: string,
    error?: Error,
    metadata?: Record<string, any>,
  ): void {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.FATAL,
      message,
      component,
      metadata: this.config.includeMetadata ? metadata : undefined,
    };

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    this.addLogEntry(logEntry);
  }

  /**
   * Generic log method
   */
  private log(
    level: LogLevel,
    message: string,
    component: string,
    metadata?: Record<string, any>,
  ): void {
    if (
      ScrapingLogger.LOG_LEVELS[level] <
      ScrapingLogger.LOG_LEVELS[this.config.logLevel]
    ) {
      return; // Skip if below configured log level
    }

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      component,
      metadata: this.config.includeMetadata ? metadata : undefined,
    };

    this.addLogEntry(logEntry);
  }

  /**
   * Add a log entry to the buffer
   */
  private addLogEntry(entry: LogEntry): void {
    this.logBuffer.push(entry);

    // Log to console immediately if configured
    if (this.config.logToConsole) {
      this.logToConsole(entry);
    }

    // Flush immediately for error and fatal levels
    if (entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL) {
      this.flushLogs();
    }
  }

  /**
   * Log entry to console
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = this.formatTimestamp(entry.timestamp);
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const componentStr = `[${entry.component}]`.padEnd(20);

    let logMessage = `${timestamp} ${levelStr} ${componentStr} ${entry.message}`;

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      logMessage += ` | ${JSON.stringify(entry.metadata)}`;
    }

    if (entry.error) {
      logMessage += `\nError: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        logMessage += `\nStack: ${entry.error.stack}`;
      }
    }

    // Use appropriate console method based on log level
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
      case LogLevel.INFO:
        console.info(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }

  /**
   * Flush buffered logs to file
   */
  private async flushLogs(): Promise<void> {
    if (!this.config.logToFile || this.logBuffer.length === 0) {
      return;
    }

    try {
      const logEntries = [...this.logBuffer];
      this.logBuffer = [];

      const logContent =
        logEntries.map((entry) => this.formatLogEntry(entry)).join("\n") + "\n";

      const logFile = await this.getCurrentLogFile();
      await appendFile(logFile, logContent, "utf8");

      // Check if log rotation is needed
      await this.rotateLogsIfNeeded(logFile);
    } catch (error) {
      console.error("Failed to flush logs to file:", error);
    }
  }

  /**
   * Format a log entry for file output
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = this.formatTimestamp(entry.timestamp);
    const level = entry.level.toUpperCase().padEnd(5);
    const component = entry.component.padEnd(20);

    let logLine = `${timestamp} ${level} [${component}] ${entry.message}`;

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      logLine += ` | metadata=${JSON.stringify(entry.metadata)}`;
    }

    if (entry.error) {
      logLine += ` | error=${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        logLine += ` | stack=${entry.error.stack.replace(/\n/g, "\\n")}`;
      }
    }

    return logLine;
  }

  /**
   * Format timestamp according to configuration
   */
  private formatTimestamp(date: Date): string {
    // Simple ISO format - in production you might want to use a date formatting library
    return date.toISOString().replace("T", " ").replace("Z", "");
  }

  /**
   * Get the current log file path
   */
  private async getCurrentLogFile(): Promise<string> {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const logFile = join(this.config.logDirectory, `scraping-${today}.log`);

    if (this.currentLogFile !== logFile) {
      this.currentLogFile = logFile;
    }

    return logFile;
  }

  /**
   * Rotate logs if the current file exceeds max size
   */
  private async rotateLogsIfNeeded(logFile: string): Promise<void> {
    try {
      const stats = await import("fs/promises").then((fs) => fs.stat(logFile));

      if (stats.size > this.config.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const rotatedFile = logFile.replace(".log", `-${timestamp}.log`);

        await import("fs/promises").then((fs) =>
          fs.rename(logFile, rotatedFile),
        );

        this.info(`Log file rotated: ${rotatedFile}`, "ScrapingLogger");

        // Clean up old log files
        await this.cleanupOldLogs();
      }
    } catch (error) {
      console.error("Failed to rotate logs:", error);
    }
  }

  /**
   * Clean up old log files beyond the configured limit
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const fs = await import("fs/promises");
      const files = await fs.readdir(this.config.logDirectory);

      const logFiles = files
        .filter((file) => file.startsWith("scraping-") && file.endsWith(".log"))
        .map((file) => ({
          name: file,
          path: join(this.config.logDirectory, file),
        }));

      if (logFiles.length > this.config.maxFiles) {
        // Sort by modification time and remove oldest files
        const fileStats = await Promise.all(
          logFiles.map(async (file) => ({
            ...file,
            stats: await fs.stat(file.path),
          })),
        );

        fileStats.sort(
          (a, b) => a.stats.mtime.getTime() - b.stats.mtime.getTime(),
        );

        const filesToDelete = fileStats.slice(
          0,
          fileStats.length - this.config.maxFiles,
        );

        for (const file of filesToDelete) {
          await fs.unlink(file.path);
          this.info(`Deleted old log file: ${file.name}`, "ScrapingLogger");
        }
      }
    } catch (error) {
      console.error("Failed to cleanup old logs:", error);
    }
  }

  /**
   * Create a logger function for use with other components
   */
  createLogger(
    component: string,
  ): (
    message: string,
    level?: LogLevel,
    metadata?: Record<string, any>,
  ) => void {
    return (
      message: string,
      level: LogLevel = LogLevel.INFO,
      metadata?: Record<string, any>,
    ) => {
      switch (level) {
        case LogLevel.DEBUG:
          this.debug(message, component, metadata);
          break;
        case LogLevel.INFO:
          this.info(message, component, metadata);
          break;
        case LogLevel.WARN:
          this.warn(message, component, metadata);
          break;
        case LogLevel.ERROR:
          this.error(message, component, undefined, metadata);
          break;
        case LogLevel.FATAL:
          this.fatal(message, component, undefined, metadata);
          break;
        default:
          this.info(message, component, metadata);
      }
    };
  }

  /**
   * Create a simple logger function compatible with existing components
   */
  createSimpleLogger(
    component: string,
  ): (message: string, level?: "info" | "warn" | "error") => void {
    return (message: string, level: "info" | "warn" | "error" = "info") => {
      switch (level) {
        case "info":
          this.info(message, component);
          break;
        case "warn":
          this.warn(message, component);
          break;
        case "error":
          this.error(message, component);
          break;
        default:
          this.info(message, component);
      }
    };
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Update logger configuration
   */
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.info("Logger configuration updated", "ScrapingLogger", { newConfig });
  }

  /**
   * Get current logger configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Shutdown the logger gracefully
   */
  async shutdown(): Promise<void> {
    this.info("Shutting down ScrapingLogger", "ScrapingLogger");

    // Stop the flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush any remaining logs
    await this.flushLogs();

    console.log("ScrapingLogger shutdown complete");
  }
}
