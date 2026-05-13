import { Injectable, Logger } from '@nestjs/common';
import { WebsocketGateway } from './notification-websocket.service';

@Injectable()
export class LogSimulatorService {
  private readonly logger = new Logger(LogSimulatorService.name);
  private intervalRef: NodeJS.Timeout | null = null;

  constructor(private readonly jobLogGateway: WebsocketGateway) {}

  /** Start pushing random logs every 2s */
  startSimulation() {
    if (this.intervalRef) {
      this.logger.warn('Simulation already running');
      return;
    }

    this.logger.log('Starting log simulation for all active sessions...');

    this.intervalRef = setInterval(async () => {
      // 🔹 Get all active rooms from gateway
      const sessionIds = await this.jobLogGateway.getActiveSessions();

      if (!sessionIds || sessionIds.length === 0) {
        // this.logger.debug('No active sessions to push logs to');
        return;
      }

      const levels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
      const randomLevel = levels[Math.floor(Math.random() * levels.length)];
      const randomMessage = `Simulated ${randomLevel} log at ${new Date().toISOString()}`;

      for (const sessionId of sessionIds) {
        this.jobLogGateway.pushLog(sessionId, randomMessage);
        // this.logger.debug(`Pushed ${randomLevel} log to session ${sessionId}`);
      }
    }, 2000); // every 2 seconds
  }

  /** Stop simulation */
  stopSimulation() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
      this.logger.log('Stopped log simulation');
    }
  }
}
