import { ApiResponse } from '../types/common.types';

/**
 * 统一的响应构建器
 */
export class ResponseHelper {
  /**
   * 构建成功响应
   */
  static success<T>(data: T, message: string = '操作成功'): ApiResponse<T> {
    return {
      success: true,
      message,
      data
    };
  }

  /**
   * 构建错误响应
   */
  static error(message: string): ApiResponse<any> {
    return {
      success: false,
      message,
      data: null
    };
  }

  /**
   * 构建创建成功响应
   */
  static created<T = any>(data: T, message: string = '创建成功'): ApiResponse<T> {
    return {
      success: true,
      message,
      data
    };
  }

  /**
   * 构建更新成功响应
   */
  static updated<T = any>(data: T, message: string = '更新成功'): ApiResponse<T> {
    return {
      success: true,
      message,
      data
    };
  }

  /**
   * 构建删除成功响应
   */
  static deleted(message: string = '删除成功'): ApiResponse<{ deleted: boolean }> {
    return {
      success: true,
      message,
      data: { deleted: true }
    };
  }

  /**
   * 构建查询成功响应
   */
  static found<T>(data: T, message: string = '查询成功'): ApiResponse<T> {
    return {
      success: true,
      message,
      data
    };
  }

  /**
   * 构建登录成功响应
   */
  static login<T>(data: T, message: string = '登录成功'): ApiResponse<T> {
    return {
      success: true,
      message,
      data
    };
  }

  /**
   * 构建登出成功响应
   */
  static logout(message: string = '登出成功'): ApiResponse<null> {
    return {
      success: true,
      message,
      data: null
    };
  }
}