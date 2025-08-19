import { Injectable, Logger } from '@nestjs/common';
import { Message } from './message-broker.service';
import { DOMAIN_EVENTS } from './domain-events';
import { CacheService } from '../infrastructure/cache.service';

@Injectable()
export class DomainEventHandlers {
  private readonly logger = new Logger(DomainEventHandlers.name);

  constructor(private readonly cacheService: CacheService) {}

  async handleUserEvents(messages: Message[]): Promise<void> {
    for (const message of messages) {
      try {
        switch (message.eventType) {
          case DOMAIN_EVENTS.USER_CREATED:
            await this.handleUserCreated(message);
            break;
          case DOMAIN_EVENTS.USER_UPDATED:
            await this.handleUserUpdated(message);
            break;
          case DOMAIN_EVENTS.USER_DELETED:
            await this.handleUserDeleted(message);
            break;
          default:
            this.logger.warn(`Unhandled user event type: ${message.eventType}`);
        }
      } catch (error) {
        this.logger.error(`Failed to handle user event ${message.eventType}: ${error.message}`, error);
        throw error; // Re-throw to prevent message acknowledgment
      }
    }
  }

  async handleCampusEvents(messages: Message[]): Promise<void> {
    for (const message of messages) {
      try {
        switch (message.eventType) {
          case DOMAIN_EVENTS.CAMPUS_CREATED:
            await this.handleCampusCreated(message);
            break;
          case DOMAIN_EVENTS.CAMPUS_UPDATED:
            await this.handleCampusUpdated(message);
            break;
          case DOMAIN_EVENTS.CAMPUS_DELETED:
            await this.handleCampusDeleted(message);
            break;
          case DOMAIN_EVENTS.CAMPUS_PRINCIPAL_ASSIGNED:
            await this.handleCampusPrincipalAssigned(message);
            break;
          default:
            this.logger.warn(`Unhandled campus event type: ${message.eventType}`);
        }
      } catch (error) {
        this.logger.error(`Failed to handle campus event ${message.eventType}: ${error.message}`, error);
        throw error;
      }
    }
  }

  async handlePayrollEvents(messages: Message[]): Promise<void> {
    for (const message of messages) {
      try {
        switch (message.eventType) {
          case DOMAIN_EVENTS.COMPENSATION_CREATED:
          case DOMAIN_EVENTS.COMPENSATION_UPDATED:
            await this.handleCompensationChanged(message);
            break;
          case DOMAIN_EVENTS.PAYROLL_GENERATED:
            await this.handlePayrollGenerated(message);
            break;
          case DOMAIN_EVENTS.PAYROLL_CONFIRMED:
            await this.handlePayrollConfirmed(message);
            break;
          default:
            this.logger.warn(`Unhandled payroll event type: ${message.eventType}`);
        }
      } catch (error) {
        this.logger.error(`Failed to handle payroll event ${message.eventType}: ${error.message}`, error);
        throw error;
      }
    }
  }

  private async handleUserCreated(message: Message): Promise<void> {
    this.logger.log(`User created: ${message.payload.userId} in org ${message.orgId}`);
    
    // Invalidate related caches
    await this.cacheService.invalidatePattern(`user:*`);
    await this.cacheService.invalidatePattern(`campus:${message.payload.campusId}:users`);
    
    // Could trigger other side effects like:
    // - Send welcome email
    // - Create default permissions
    // - Notify campus principal
  }

  private async handleUserUpdated(message: Message): Promise<void> {
    this.logger.log(`User updated: ${message.payload.userId}`);
    
    // Invalidate user cache
    await this.cacheService.invalidateUser(message.payload.userId);
    
    // If campus assignment changed, invalidate campus caches
    if (message.payload.changes.campus_id) {
      const oldCampusId = message.payload.changes.campus_id.from;
      const newCampusId = message.payload.changes.campus_id.to;
      
      if (oldCampusId) {
        await this.cacheService.invalidatePattern(`campus:${oldCampusId}:*`);
      }
      if (newCampusId) {
        await this.cacheService.invalidatePattern(`campus:${newCampusId}:*`);
      }
    }
  }

  private async handleUserDeleted(message: Message): Promise<void> {
    this.logger.log(`User deleted: ${message.payload.userId}`);
    
    // Clean up all user-related caches
    await this.cacheService.invalidateUser(message.payload.userId);
    await this.cacheService.invalidateUserCompensations(message.payload.userId);
    
    // Could trigger cleanup of:
    // - User sessions
    // - Pending payroll runs
    // - File uploads
  }

  private async handleCampusCreated(message: Message): Promise<void> {
    this.logger.log(`Campus created: ${message.payload.campusId} in org ${message.orgId}`);
    
    // Invalidate org-level campus lists
    await this.cacheService.invalidatePattern(`org:${message.orgId}:campuses`);
    
    // If principal assigned, validate user exists
    if (message.payload.principalUserId) {
      // This would typically make a service call to validate the user
      this.logger.log(`Campus principal assigned: user ${message.payload.principalUserId}`);
    }
  }

  private async handleCampusUpdated(message: Message): Promise<void> {
    this.logger.log(`Campus updated: ${message.payload.campusId}`);
    
    // Invalidate campus cache
    await this.cacheService.invalidateCampus(message.payload.campusId);
    
    // If principal changed, handle validation
    if (message.payload.changes.principal_user_id) {
      await this.handleCampusPrincipalChange(message);
    }
  }

  private async handleCampusDeleted(message: Message): Promise<void> {
    this.logger.log(`Campus deleted: ${message.payload.campusId}`);
    
    // Clean up campus-related caches
    await this.cacheService.invalidateCampus(message.payload.campusId);
    await this.cacheService.invalidatePattern(`campus:${message.payload.campusId}:*`);
  }

  private async handleCampusPrincipalAssigned(message: Message): Promise<void> {
    this.logger.log(`Campus principal assigned: ${message.payload.newPrincipalId} to campus ${message.payload.campusId}`);
    
    // Invalidate campus cache
    await this.cacheService.invalidateCampus(message.payload.campusId);
    
    // Could trigger notifications or permission updates
  }

  private async handleCompensationChanged(message: Message): Promise<void> {
    this.logger.log(`Compensation changed for user: ${message.payload.userId}`);
    
    // Invalidate compensation caches
    await this.cacheService.invalidateUserCompensations(message.payload.userId);
    
    // Invalidate any cached payroll calculations
    await this.cacheService.invalidatePattern(`monthly:${message.payload.userId}:*`);
  }

  private async handlePayrollGenerated(message: Message): Promise<void> {
    this.logger.log(`Payroll generated: run ${message.payload.runId} for user ${message.payload.userId}`);
    
    // Cache the payroll result
    const cacheKey = this.cacheService.getMonthlyCalculationKey(message.payload.userId, message.payload.month);
    await this.cacheService.set(cacheKey, message.payload, 7200); // Cache for 2 hours
  }

  private async handlePayrollConfirmed(message: Message): Promise<void> {
    this.logger.log(`Payroll confirmed: run ${message.payload.runId}`);
    
    // Extend cache TTL for confirmed payrolls
    const cacheKey = this.cacheService.getMonthlyCalculationKey(message.payload.userId, message.payload.month);
    await this.cacheService.set(cacheKey, message.payload, 86400 * 7); // Cache for 1 week
    
    // Could trigger:
    // - Payment processing
    // - Notification to user
    // - Accounting system integration
  }

  private async handleCampusPrincipalChange(message: Message): Promise<void> {
    // Cross-service validation logic would go here
    // For now, just log the change
    const changes = message.payload.changes.principal_user_id;
    this.logger.log(`Campus principal changed from ${changes.from} to ${changes.to} for campus ${message.payload.campusId}`);
  }
}