import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../infrastructure/redis.service';
import Redis from 'ioredis';

export interface Message {
  id: string;
  streamName: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  orgId: number;
  payload: any;
  timestamp: number;
  version: number;
  correlationId?: string;
  causationId?: string;
}

export interface StreamConsumer {
  groupName: string;
  consumerName: string;
  streams: string[];
  handler: (messages: Message[]) => Promise<void>;
}

@Injectable()
export class MessageBrokerService implements OnModuleDestroy {
  private readonly logger = new Logger(MessageBrokerService.name);
  private readonly consumers = new Map<string, Redis>();
  private readonly streamPrefix: string;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService
  ) {
    this.streamPrefix = this.configService.get('MESSAGE_STREAM_PREFIX', 'eduhub:events');
  }

  async onModuleDestroy() {
    // Clean shutdown all consumers
    for (const [consumerName, client] of this.consumers.entries()) {
      this.logger.log(`Shutting down consumer: ${consumerName}`);
      await client.quit();
    }
    this.consumers.clear();
  }

  /**
   * Publish a message to a Redis Stream
   */
  async publishMessage(message: Omit<Message, 'id' | 'timestamp' | 'streamName'>): Promise<string> {
    const streamName = this.getStreamName(message.eventType);
    const messageId = await this.redisService.getClient().xadd(
      streamName,
      '*', // Auto-generate ID
      'eventType', message.eventType,
      'aggregateId', message.aggregateId,
      'aggregateType', message.aggregateType,
      'orgId', message.orgId.toString(),
      'payload', JSON.stringify(message.payload),
      'timestamp', Date.now(),
      'version', message.version.toString(),
      'correlationId', message.correlationId || '',
      'causationId', message.causationId || ''
    );

    this.logger.debug(`Published message to stream ${streamName}: ${messageId}`);
    return messageId || '';
  }

  /**
   * Subscribe to messages using consumer groups
   */
  async subscribeToStreams(consumer: StreamConsumer): Promise<void> {
    const client = this.redisService.getClient().duplicate();
    await client.connect();
    
    this.consumers.set(consumer.consumerName, client);

    // Create consumer groups for each stream
    for (const streamPattern of consumer.streams) {
      const streamName = this.getStreamName(streamPattern);
      
      try {
        await client.xgroup('CREATE', streamName, consumer.groupName, '$', 'MKSTREAM');
        this.logger.log(`Created consumer group ${consumer.groupName} for stream ${streamName}`);
      } catch (error) {
        if (error.message.includes('BUSYGROUP')) {
          this.logger.debug(`Consumer group ${consumer.groupName} already exists for stream ${streamName}`);
        } else {
          this.logger.error(`Failed to create consumer group: ${error.message}`);
        }
      }
    }

    // Start consuming messages
    this.startConsuming(client, consumer);
  }

  private async startConsuming(client: Redis, consumer: StreamConsumer): Promise<void> {
    const streamNames = consumer.streams.map(pattern => this.getStreamName(pattern));
    
    while (this.consumers.has(consumer.consumerName)) {
      try {
        // Read from streams
        const streams = streamNames.flatMap(name => [name, '>']);
        const result = await client.xreadgroup(
          'GROUP', consumer.groupName, consumer.consumerName,
          'COUNT', 10,
          'BLOCK', 5000,
          'STREAMS', ...streams
        );

        if (result && result.length > 0) {
          const messages: Message[] = [];
          
          for (const [streamName, entries] of result) {
            for (const [id, fields] of entries) {
              const message = this.parseMessage(id, streamName, fields);
              if (message) {
                messages.push(message);
              }
            }
          }

          if (messages.length > 0) {
            try {
              await consumer.handler(messages);
              
              // Acknowledge processed messages
              for (const message of messages) {
                await client.xack(message.streamName, consumer.groupName, message.id);
              }
              
              this.logger.debug(`Processed ${messages.length} messages for consumer ${consumer.consumerName}`);
            } catch (handlerError) {
              this.logger.error(`Handler error for consumer ${consumer.consumerName}: ${handlerError.message}`);
              // Messages will remain unacknowledged and can be retried
            }
          }
        }
      } catch (error) {
        if (this.consumers.has(consumer.consumerName)) {
          this.logger.error(`Consumer ${consumer.consumerName} error: ${error.message}`);
          await this.sleep(1000); // Wait before retry
        }
      }
    }
  }

  private parseMessage(id: string, streamName: string, fields: string[]): Message | null {
    try {
      const fieldMap = new Map<string, string>();
      for (let i = 0; i < fields.length; i += 2) {
        fieldMap.set(fields[i], fields[i + 1]);
      }

      return {
        id,
        streamName,
        eventType: fieldMap.get('eventType') || '',
        aggregateId: fieldMap.get('aggregateId') || '',
        aggregateType: fieldMap.get('aggregateType') || '',
        orgId: parseInt(fieldMap.get('orgId') || '0'),
        payload: JSON.parse(fieldMap.get('payload') || '{}'),
        timestamp: parseInt(fieldMap.get('timestamp') || '0'),
        version: parseInt(fieldMap.get('version') || '1'),
        correlationId: fieldMap.get('correlationId') || undefined,
        causationId: fieldMap.get('causationId') || undefined
      };
    } catch (error) {
      this.logger.error(`Failed to parse message ${id}: ${error.message}`);
      return null;
    }
  }

  private getStreamName(eventType: string): string {
    return `${this.streamPrefix}:${eventType}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get stream information and pending messages
   */
  async getStreamInfo(eventType: string): Promise<any> {
    const streamName = this.getStreamName(eventType);
    try {
      return await this.redisService.getClient().xinfo('STREAM', streamName);
    } catch (error) {
      this.logger.error(`Failed to get stream info for ${streamName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Manually acknowledge a message (for error recovery)
   */
  async acknowledgeMessage(streamName: string, groupName: string, messageId: string): Promise<void> {
    await this.redisService.getClient().xack(this.getStreamName(streamName), groupName, messageId);
  }

  /**
   * Get pending messages for a consumer group
   */
  async getPendingMessages(eventType: string, groupName: string): Promise<any> {
    const streamName = this.getStreamName(eventType);
    try {
      return await this.redisService.getClient().xpending(streamName, groupName);
    } catch (error) {
      this.logger.error(`Failed to get pending messages for ${streamName}: ${error.message}`);
      return null;
    }
  }
}