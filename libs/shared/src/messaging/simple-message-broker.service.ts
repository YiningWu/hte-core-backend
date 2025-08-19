import { Injectable, Logger } from '@nestjs/common';

export interface Message {
  id: string;
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

@Injectable()
export class MessageBrokerService {
  private readonly logger = new Logger(MessageBrokerService.name);

  async publishMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<string> {
    // Simple implementation for development - just log the event
    const messageId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    this.logger.log(`Event published: ${message.eventType} for ${message.aggregateType}:${message.aggregateId}`);
    this.logger.debug(`Event details:`, { 
      messageId,
      eventType: message.eventType,
      aggregateId: message.aggregateId,
      payload: message.payload 
    });
    
    return messageId;
  }
}