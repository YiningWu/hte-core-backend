import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiResponse } from '../types/common.types';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || responseObj.error || '请求处理失败';
        
        // 如果message是数组（通常是验证错误），取第一个
        if (Array.isArray(message)) {
          message = message[0];
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message || '服务器内部错误';
    }

    // 根据状态码自定义错误消息
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        if (message === 'Bad Request Exception') {
          message = '请求参数错误';
        }
        break;
      case HttpStatus.UNAUTHORIZED:
        if (message === 'Unauthorized') {
          message = '未授权访问';
        }
        break;
      case HttpStatus.FORBIDDEN:
        if (message === 'Forbidden') {
          message = '权限不足';
        }
        break;
      case HttpStatus.NOT_FOUND:
        if (message === 'Not Found') {
          message = '资源不存在';
        }
        break;
      case HttpStatus.CONFLICT:
        if (message === 'Conflict') {
          message = '资源冲突';
        }
        break;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        if (message === 'Unprocessable Entity') {
          message = '数据验证失败';
        }
        break;
      case HttpStatus.INTERNAL_SERVER_ERROR:
        message = '服务器内部错误';
        break;
    }

    const errorResponse: ApiResponse<null> = {
      success: false,
      message,
      data: null,
    };

    response.status(status).json(errorResponse);
  }
}