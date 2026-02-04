import { createApp } from "./app";
import { database } from "./config/database";
import { config, validateEnvironment } from "./config/environment";

async function startServer(): Promise<void> {
  try {
    // Validate environment variables
    validateEnvironment();

    // Connect to database
    await database.connect();

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(config.server.port, () => {
      console.log(
        `🚀 Sydney Events Aggregator API running on port ${config.server.port}`,
      );
      console.log(`📊 Environment: ${config.server.nodeEnv}`);
      console.log(
        `🔗 Health check: http://localhost:${config.server.port}/health`,
      );
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        console.log("HTTP server closed");

        try {
          await database.disconnect();
          console.log("Database connection closed");
          process.exit(0);
        } catch (error) {
          console.error("Error during shutdown:", error);
          process.exit(1);
        }
      });
    };

    // Handle shutdown signals
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer();
}
