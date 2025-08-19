import { Injectable, Logger, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface ServiceEndpoints {
  userService: string;
  campusService: string;
  payrollService: string;
}

@Injectable()
export class ServiceClient {
  private readonly logger = new Logger(ServiceClient.name);
  private readonly httpClient: AxiosInstance;
  private readonly endpoints: ServiceEndpoints;

  constructor(private readonly configService: ConfigService) {
    this.endpoints = {
      userService: this.configService.get('USER_SERVICE_URL', 'http://localhost:3001'),
      campusService: this.configService.get('CAMPUS_SERVICE_URL', 'http://localhost:3002'),
      payrollService: this.configService.get('PAYROLL_SERVICE_URL', 'http://localhost:3003')
    };

    this.httpClient = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // Add request interceptor for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug(`Making request to ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('Request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logger.error(`Service call failed: ${error instanceof Error ? error.message : String(error)}`);
        if (error.response) {
          throw new HttpException(
            error.response.data,
            error.response.status
          );
        }
        throw error;
      }
    );
  }

  async get<T>(service: keyof ServiceEndpoints, path: string, config?: AxiosRequestConfig): Promise<T> {
    const url = `${this.endpoints[service]}${path}`;
    const response = await this.httpClient.get<T>(url, config);
    return response.data;
  }

  async post<T>(service: keyof ServiceEndpoints, path: string, data: any, config?: AxiosRequestConfig): Promise<T> {
    const url = `${this.endpoints[service]}${path}`;
    const response = await this.httpClient.post<T>(url, data, config);
    return response.data;
  }

  async patch<T>(service: keyof ServiceEndpoints, path: string, data: any, config?: AxiosRequestConfig): Promise<T> {
    const url = `${this.endpoints[service]}${path}`;
    const response = await this.httpClient.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(service: keyof ServiceEndpoints, path: string, config?: AxiosRequestConfig): Promise<T> {
    const url = `${this.endpoints[service]}${path}`;
    const response = await this.httpClient.delete<T>(url, config);
    return response.data;
  }

  // Convenience methods for common operations
  async validateUser(userId: number, orgId: number, authToken: string): Promise<any> {
    try {
      return await this.get('userService', `/core/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Org-Id': orgId.toString()
        }
      });
    } catch (error) {
      this.logger.warn(`User validation failed for user ${userId}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async getCampusInfo(campusId: number, orgId: number, authToken: string): Promise<any> {
    try {
      return await this.get('campusService', `/core/campuses/${campusId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Org-Id': orgId.toString()
        }
      });
    } catch (error) {
      this.logger.warn(`Campus info retrieval failed for campus ${campusId}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async getUserCompensation(userId: number, date: string, authToken: string): Promise<any> {
    try {
      return await this.get('payrollService', `/core/payroll/compensations/effective?user_id=${userId}&date=${date}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    } catch (error) {
      this.logger.warn(`Compensation retrieval failed for user ${userId}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}