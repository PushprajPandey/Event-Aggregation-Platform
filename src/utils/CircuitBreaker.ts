/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = "closed", // Normal operation
  OPEN = "open", // Failing, rejecting requests
  HALF_OPEN = "half_open", // Testing if service recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  recoveryTimeout: number; // Time to wait before trying again (ms)
  monitoringPeriod: number; // Time window for failure counting (ms)
  successThreshold: number; // Successes needed to close from half-open
}

/**
 * Circuit breaker for protecting against cascading failures
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private failureTimes: number[] = [];

  constructor(
    private name: string,
    private config: CircuitBreakerConfig,
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        console.log(`Circuit breaker ${this.name} transitioning to HALF_OPEN`);
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.failures = 0;
    this.failureTimes = [];

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
        this.successes = 0;
        console.log(`Circuit breaker ${this.name} transitioning to CLOSED`);
      }
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    const now = Date.now();
    this.failures++;
    this.lastFailureTime = now;
    this.failureTimes.push(now);

    // Clean old failure times outside monitoring period
    this.failureTimes = this.failureTimes.filter(
      (time) => now - time <= this.config.monitoringPeriod,
    );

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      this.successes = 0;
      console.log(
        `Circuit breaker ${this.name} transitioning to OPEN from HALF_OPEN`,
      );
    } else if (
      this.state === CircuitBreakerState.CLOSED &&
      this.failureTimes.length >= this.config.failureThreshold
    ) {
      this.state = CircuitBreakerState.OPEN;
      console.log(
        `Circuit breaker ${this.name} transitioning to OPEN from CLOSED`,
      );
    }
  }

  /**
   * Check if we should attempt to reset the circuit breaker
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.recoveryTimeout;
  }

  /**
   * Get current circuit breaker status
   */
  getStatus(): {
    name: string;
    state: CircuitBreakerState;
    failures: number;
    successes: number;
    lastFailureTime: number;
    isHealthy: boolean;
  } {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      isHealthy: this.state === CircuitBreakerState.CLOSED,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    this.failureTimes = [];
    console.log(`Circuit breaker ${this.name} manually reset`);
  }

  /**
   * Check if circuit breaker is open
   */
  isOpen(): boolean {
    return this.state === CircuitBreakerState.OPEN;
  }

  /**
   * Check if circuit breaker is closed (healthy)
   */
  isClosed(): boolean {
    return this.state === CircuitBreakerState.CLOSED;
  }
}

/**
 * Circuit breaker manager for managing multiple circuit breakers
 */
export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  /**
   * Create or get a circuit breaker
   */
  getCircuitBreaker(
    name: string,
    config?: CircuitBreakerConfig,
  ): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 300000, // 5 minutes
        successThreshold: 3,
      };

      this.circuitBreakers.set(
        name,
        new CircuitBreaker(name, config || defaultConfig),
      );
    }

    return this.circuitBreakers.get(name)!;
  }

  /**
   * Get all circuit breaker statuses
   */
  getAllStatuses(): Array<ReturnType<CircuitBreaker["getStatus"]>> {
    return Array.from(this.circuitBreakers.values()).map((cb) =>
      cb.getStatus(),
    );
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.circuitBreakers.forEach((cb) => cb.reset());
  }

  /**
   * Get health summary
   */
  getHealthSummary(): {
    total: number;
    healthy: number;
    unhealthy: number;
    overallHealthy: boolean;
  } {
    const statuses = this.getAllStatuses();
    const healthy = statuses.filter((status) => status.isHealthy).length;

    return {
      total: statuses.length,
      healthy,
      unhealthy: statuses.length - healthy,
      overallHealthy: healthy === statuses.length,
    };
  }
}
