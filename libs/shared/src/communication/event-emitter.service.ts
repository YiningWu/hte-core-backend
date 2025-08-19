import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../infrastructure/redis.service';

export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: number;
  aggregateType: string;
  orgId: number;
  payload: any;
  timestamp: Date;
  version: number;
}

@Injectable()
export class EventEmitterService {
  private readonly logger = new Logger(EventEmitterService.name);

  constructor(private readonly redisService: RedisService) {}

  async emitEvent(event: Omit<DomainEvent, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
    const domainEvent: DomainEvent = {
      ...event,
      eventId: this.generateEventId(),
      timestamp: new Date(),
      version: 1
    };

    try {
      // Publish to Redis pub/sub
      const channel = `events:${event.eventType}`;
      await this.redisService.getClient().publish(channel, JSON.stringify(domainEvent));

      // Store in event log for replay/audit
      const eventKey = `event_log:${event.aggregateType}:${event.aggregateId}:${domainEvent.eventId}`;
      await this.redisService.set(eventKey, JSON.stringify(domainEvent), 86400); // 24 hours TTL

      this.logger.log(`Event emitted: ${event.eventType} for ${event.aggregateType}:${event.aggregateId}`);
    } catch (error) {
      this.logger.error(`Failed to emit event: ${error instanceof Error ? error.message : String(error)}`, error);
      throw error;
    }
  }

  async subscribeToEvents(eventTypes: string[], handler: (event: DomainEvent) => Promise<void>): Promise<void> {
    const client = this.redisService.getClient().duplicate();

    try {
      await client.connect();

      const channels = eventTypes.map(type => `events:${type}`);
      await client.subscribe(...channels);

      client.on('message', async (channel, message) => {
        try {
          const event: DomainEvent = JSON.parse(message);
          await handler(event);
        } catch (error) {
          this.logger.error(`Failed to handle event from channel ${channel}: ${error instanceof Error ? error.message : String(error)}`, error);
        }
      });

      this.logger.log(`Subscribed to event channels: ${channels.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to events: ${error instanceof Error ? error.message : String(error)}`, error);
      await client.quit();
      throw error;
    }
  }

  // Predefined event types
  static readonly EVENT_TYPES = {
    USER_CREATED: 'user.created',
    USER_UPDATED: 'user.updated',
    USER_DELETED: 'user.deleted',
    CAMPUS_CREATED: 'campus.created',
    CAMPUS_UPDATED: 'campus.updated',
    CAMPUS_DELETED: 'campus.deleted',
    COMPENSATION_CREATED: 'compensation.created',
    COMPENSATION_UPDATED: 'compensation.updated',
    PAYROLL_GENERATED: 'payroll.generated',
    PAYROLL_CONFIRMED: 'payroll.confirmed'
  } as const;

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}