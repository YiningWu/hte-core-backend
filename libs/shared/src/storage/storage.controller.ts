import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  Query,
  Res,
  BadRequestException,
  NotFoundException,
  UseGuards
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { StorageService, StorageFile } from './storage.service';

export interface UploadFileDto {
  folder: string;
  isPublic?: boolean;
}

export interface GenerateUploadUrlDto {
  fileName: string;
  contentType: string;
  folder: string;
}

@Controller('storage')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Upload a file
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadFileDto,
    @CurrentUser() user: any
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!uploadDto.folder) {
      throw new BadRequestException('Folder is required');
    }

    const storageFile: StorageFile = {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    };

    const result = await this.storageService.uploadFile(
      storageFile,
      uploadDto.folder,
      user.userId,
      user.orgId,
      uploadDto.isPublic
    );

    return {
      success: true,
      data: result
    };
  }

  /**
   * Generate presigned URL for direct upload
   */
  @Post('presigned-upload-url')
  async generateUploadUrl(
    @Body() dto: GenerateUploadUrlDto,
    @CurrentUser() user: any
  ) {
    const result = await this.storageService.getPresignedUploadUrl(
      dto.fileName,
      dto.folder,
      dto.contentType,
      user.orgId
    );

    return {
      success: true,
      data: result
    };
  }

  /**
   * Download a file
   */
  @Get('download/:key(*)')
  async downloadFile(
    @Param('key') key: string,
    @Res() res: Response,
    @CurrentUser() user: any
  ) {
    try {
      // Check if user has access to this file
      if (key.includes('/private/') && !key.includes(`/org-${user.orgId}/`)) {
        throw new BadRequestException('Access denied to this file');
      }

      const file = await this.storageService.downloadFile(key);
      
      res.set({
        'Content-Type': file.contentType,
        'Content-Length': file.contentLength.toString(),
        'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`
      });

      res.send(file.buffer);
    } catch (error) {
      if (error.message.includes('NoSuchKey') || error.message.includes('Not Found')) {
        throw new NotFoundException('File not found');
      }
      throw error;
    }
  }

  /**
   * Get presigned download URL
   */
  @Get('presigned-download-url/:key(*)')
  async getPresignedDownloadUrl(
    @Param('key') key: string,
    @Query('expiresIn') expiresIn: string = '3600',
    @CurrentUser() user: any
  ) {
    // Check if user has access to this file
    if (key.includes('/private/') && !key.includes(`/org-${user.orgId}/`)) {
      throw new BadRequestException('Access denied to this file');
    }

    const url = await this.storageService.getPresignedDownloadUrl(key, parseInt(expiresIn, 10));

    return {
      success: true,
      data: { url }
    };
  }

  /**
   * Delete a file
   */
  @Delete('file/:key(*)')
  @Roles('admin', 'manager')
  async deleteFile(
    @Param('key') key: string,
    @CurrentUser() user: any
  ) {
    // Check if user has access to delete this file
    if (key.includes('/private/') && !key.includes(`/org-${user.orgId}/`)) {
      throw new BadRequestException('Access denied to delete this file');
    }

    await this.storageService.deleteFile(key);

    return {
      success: true,
      message: 'File deleted successfully'
    };
  }

  /**
   * List files in a folder
   */
  @Get('list/:folder(*)')
  async listFiles(
    @Param('folder') folder: string,
    @Query('maxKeys') maxKeys: string = '100',
    @CurrentUser() user: any
  ) {
    const files = await this.storageService.listFiles(folder, user.orgId, parseInt(maxKeys, 10));

    return {
      success: true,
      data: {
        files: files.map(file => ({
          key: file.Key,
          size: file.Size,
          lastModified: file.LastModified,
          etag: file.ETag
        }))
      }
    };
  }

  /**
   * Get file metadata
   */
  @Get('metadata/:key(*)')
  async getFileMetadata(
    @Param('key') key: string,
    @CurrentUser() user: any
  ) {
    // Check if user has access to this file
    if (key.includes('/private/') && !key.includes(`/org-${user.orgId}/`)) {
      throw new BadRequestException('Access denied to this file');
    }

    try {
      const metadata = await this.storageService.getFileMetadata(key);

      return {
        success: true,
        data: {
          contentType: metadata.ContentType,
          contentLength: metadata.ContentLength,
          lastModified: metadata.LastModified,
          etag: metadata.ETag,
          metadata: metadata.Metadata
        }
      };
    } catch (error) {
      if (error.message.includes('NoSuchKey') || error.message.includes('Not Found')) {
        throw new NotFoundException('File not found');
      }
      throw error;
    }
  }

  /**
   * Get storage statistics for the organization
   */
  @Get('stats')
  @Roles('admin', 'manager')
  async getStorageStats(@CurrentUser() user: any) {
    const stats = await this.storageService.getStorageStats(user.orgId);

    return {
      success: true,
      data: {
        fileCount: stats.count,
        totalSize: stats.totalSize,
        totalSizeFormatted: this.formatBytes(stats.totalSize)
      }
    };
  }

  /**
   * Copy a file
   */
  @Post('copy')
  @Roles('admin', 'manager')
  async copyFile(
    @Body() dto: { sourceKey: string; destinationKey: string },
    @CurrentUser() user: any
  ) {
    // Check access to source file
    if (dto.sourceKey.includes('/private/') && !dto.sourceKey.includes(`/org-${user.orgId}/`)) {
      throw new BadRequestException('Access denied to source file');
    }

    // Ensure destination is within user's org
    if (!dto.destinationKey.includes(`/org-${user.orgId}/`)) {
      dto.destinationKey = `private/org-${user.orgId}/${dto.destinationKey}`;
    }

    await this.storageService.copyFile(dto.sourceKey, dto.destinationKey);

    return {
      success: true,
      message: 'File copied successfully',
      data: { destinationKey: dto.destinationKey }
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}