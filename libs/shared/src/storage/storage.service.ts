import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);

export interface StorageFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface StorageUploadResult {
  key: string;
  url: string;
  bucket: string;
  etag: string;
}

export interface StorageDownloadResult {
  buffer: Buffer;
  contentType: string;
  contentLength: number;
  lastModified: Date;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storageType: string;
  private readonly localStoragePath: string;
  private readonly bucketName: string;
  private s3: any; // Dynamic AWS import

  constructor(private readonly configService: ConfigService) {
    this.storageType = this.configService.get('FILE_STORAGE_TYPE', 'local');
    this.localStoragePath = this.configService.get('FILE_STORAGE_PATH', './uploads');
    this.bucketName = this.configService.get('STORAGE_BUCKET', 'eduhub-files');

    if (this.storageType === 'local') {
      this.initializeLocalStorage();
    } else {
      this.initializeCloudStorage();
    }
  }

  private async initializeLocalStorage(): Promise<void> {
    try {
      await mkdir(this.localStoragePath, { recursive: true });
      this.logger.log(`Local storage initialized at: ${this.localStoragePath}`);
    } catch (error: any) {
      this.logger.error(`Failed to initialize local storage: ${error.message}`);
    }
  }

  private async initializeCloudStorage(): Promise<void> {
    try {
      // Dynamic import AWS SDK only when needed
      const AWS = await import('aws-sdk');
      
      const endpoint = this.configService.get('MINIO_ENDPOINT') || this.configService.get('AWS_S3_ENDPOINT');
      const accessKeyId = this.configService.get('MINIO_ACCESS_KEY') || this.configService.get('AWS_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get('MINIO_SECRET_KEY') || this.configService.get('AWS_SECRET_ACCESS_KEY');
      const region = this.configService.get('AWS_REGION', 'us-east-1');
      const forcePathStyle = this.configService.get('MINIO_ENDPOINT') ? true : false;

      this.s3 = new AWS.S3({
        endpoint: endpoint ? `http://${endpoint}` : undefined,
        accessKeyId,
        secretAccessKey,
        region,
        s3ForcePathStyle: forcePathStyle,
        signatureVersion: 'v4'
      });

      await this.initializeBucket();
    } catch (error: any) {
      this.logger.error(`Failed to initialize cloud storage: ${error.message}`);
      // Fallback to local storage
      this.logger.warn('Falling back to local storage');
      await this.initializeLocalStorage();
    }
  }

  private async initializeBucket(): Promise<void> {
    if (!this.s3) return;

    try {
      await this.s3.headBucket({ Bucket: this.bucketName }).promise();
      this.logger.log(`Storage bucket '${this.bucketName}' is ready`);
    } catch (error: any) {
      if (error.statusCode === 404) {
        try {
          await this.s3.createBucket({ Bucket: this.bucketName }).promise();
          this.logger.log(`Created storage bucket '${this.bucketName}'`);
        } catch (createError: any) {
          this.logger.error(`Failed to create bucket: ${createError.message}`);
        }
      }
    }
  }

  /**
   * Upload a file to storage
   */
  async uploadFile(
    file: StorageFile,
    folder: string,
    userId?: number,
    isPublic: boolean = false
  ): Promise<StorageUploadResult> {
    if (this.storageType === 'local') {
      return this.uploadFileLocal(file, folder, userId, isPublic);
    } else {
      return this.uploadFileCloud(file, folder, userId, isPublic);
    }
  }

  private async uploadFileLocal(
    file: StorageFile,
    folder: string,
    userId?: number,
    isPublic: boolean = false
  ): Promise<StorageUploadResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-${file.originalname}`;
    const subfolder = userId ? `${folder}/${userId}` : folder;
    const fullPath = path.join(this.localStoragePath, subfolder);
    const filePath = path.join(fullPath, filename);
    const key = `${subfolder}/${filename}`;

    try {
      // Ensure directory exists
      await mkdir(fullPath, { recursive: true });
      
      // Write file
      await writeFile(filePath, file.buffer);
      
      const url = `/uploads/${key}`;
      
      this.logger.log(`File uploaded locally: ${key}`);
      
      return {
        key,
        url,
        bucket: 'local',
        etag: `local-${Date.now()}`
      };
    } catch (error: any) {
      this.logger.error(`Failed to upload file locally: ${error.message}`);
      throw error;
    }
  }

  private async uploadFileCloud(
    file: StorageFile,
    folder: string,
    userId?: number,
    isPublic: boolean = false
  ): Promise<StorageUploadResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-${file.originalname}`;
    const key = userId ? `${folder}/${userId}/${filename}` : `${folder}/${filename}`;

    const params = {
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentLength: file.size,
      ACL: isPublic ? 'public-read' : 'private',
      Metadata: {
        'original-name': file.originalname,
        'upload-timestamp': new Date().toISOString(),
        ...(userId && { 'user-id': userId.toString() })
      }
    };

    try {
      const result = await this.s3.upload(params).promise();
      
      this.logger.log(`File uploaded to cloud: ${key}`);
      
      return {
        key: result.Key,
        url: result.Location,
        bucket: result.Bucket,
        etag: result.ETag
      };
    } catch (error: any) {
      this.logger.error(`Failed to upload file to cloud: ${error.message}`);
      throw error;
    }
  }

  /**
   * Download a file from storage
   */
  async downloadFile(key: string): Promise<StorageDownloadResult> {
    if (this.storageType === 'local') {
      return this.downloadFileLocal(key);
    } else {
      return this.downloadFileCloud(key);
    }
  }

  private async downloadFileLocal(key: string): Promise<StorageDownloadResult> {
    const filePath = path.join(this.localStoragePath, key);
    
    try {
      const buffer = await readFile(filePath);
      const stats = await stat(filePath);
      
      return {
        buffer,
        contentType: 'application/octet-stream', // Could be improved with mime detection
        contentLength: stats.size,
        lastModified: stats.mtime
      };
    } catch (error: any) {
      this.logger.error(`Failed to download file locally: ${error.message}`);
      throw error;
    }
  }

  private async downloadFileCloud(key: string): Promise<StorageDownloadResult> {
    const params = {
      Bucket: this.bucketName,
      Key: key
    };

    try {
      const result = await this.s3.getObject(params).promise();
      
      return {
        buffer: result.Body as Buffer,
        contentType: result.ContentType || 'application/octet-stream',
        contentLength: result.ContentLength || 0,
        lastModified: result.LastModified || new Date()
      };
    } catch (error: any) {
      this.logger.error(`Failed to download file from cloud: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(key: string): Promise<void> {
    if (this.storageType === 'local') {
      return this.deleteFileLocal(key);
    } else {
      return this.deleteFileCloud(key);
    }
  }

  private async deleteFileLocal(key: string): Promise<void> {
    const filePath = path.join(this.localStoragePath, key);
    
    try {
      await unlink(filePath);
      this.logger.log(`File deleted locally: ${key}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete file locally: ${error.message}`);
      throw error;
    }
  }

  private async deleteFileCloud(key: string): Promise<void> {
    const params = {
      Bucket: this.bucketName,
      Key: key
    };

    try {
      await this.s3.deleteObject(params).promise();
      this.logger.log(`File deleted from cloud: ${key}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete file from cloud: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate a presigned URL for file access
   */
  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (this.storageType === 'local') {
      // For local storage, return a direct path
      return `/uploads/${key}`;
    }

    if (!this.s3) {
      throw new Error('Cloud storage not initialized');
    }

    try {
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Expires: expiresIn
      };

      return this.s3.getSignedUrl('getObject', params);
    } catch (error: any) {
      this.logger.error(`Failed to generate presigned URL: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(key: string): Promise<boolean> {
    if (this.storageType === 'local') {
      const filePath = path.join(this.localStoragePath, key);
      try {
        await stat(filePath);
        return true;
      } catch {
        return false;
      }
    }

    if (!this.s3) {
      return false;
    }

    try {
      const params = {
        Bucket: this.bucketName,
        Key: key
      };

      await this.s3.headObject(params).promise();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get storage information
   */
  getStorageInfo(): { type: string; path?: string; bucket?: string } {
    if (this.storageType === 'local') {
      return {
        type: 'local',
        path: this.localStoragePath
      };
    }

    return {
      type: 'cloud',
      bucket: this.bucketName
    };
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<any> {
    if (this.storageType === 'local') {
      const filePath = path.join(this.localStoragePath, key);
      try {
        const stats = await stat(filePath);
        return {
          key,
          size: stats.size,
          lastModified: stats.mtime,
          contentType: 'application/octet-stream'
        };
      } catch (error: any) {
        this.logger.error(`Failed to get local file metadata: ${error.message}`);
        throw error;
      }
    }

    if (!this.s3) {
      throw new Error('Cloud storage not initialized');
    }

    try {
      const params = {
        Bucket: this.bucketName,
        Key: key
      };

      const result = await this.s3.headObject(params).promise();
      return {
        key,
        size: result.ContentLength,
        lastModified: result.LastModified,
        contentType: result.ContentType,
        etag: result.ETag,
        metadata: result.Metadata
      };
    } catch (error: any) {
      this.logger.error(`Failed to get cloud file metadata: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(orgId: number): Promise<any> {
    if (this.storageType === 'local') {
      // For local storage, we can scan the directory
      try {
        const orgPath = path.join(this.localStoragePath, orgId.toString());
        if (!fs.existsSync(orgPath)) {
          return {
            totalFiles: 0,
            totalSize: 0,
            storageType: 'local'
          };
        }

        let totalFiles = 0;
        let totalSize = 0;

        const scanDir = (dirPath: string) => {
          const items = fs.readdirSync(dirPath, { withFileTypes: true });
          for (const item of items) {
            if (item.isDirectory()) {
              scanDir(path.join(dirPath, item.name));
            } else {
              const filePath = path.join(dirPath, item.name);
              const stats = fs.statSync(filePath);
              totalFiles++;
              totalSize += stats.size;
            }
          }
        };

        scanDir(orgPath);

        return {
          totalFiles,
          totalSize,
          storageType: 'local',
          orgId
        };
      } catch (error: any) {
        this.logger.error(`Failed to get local storage stats: ${error.message}`);
        return {
          totalFiles: 0,
          totalSize: 0,
          storageType: 'local',
          orgId
        };
      }
    }

    // For cloud storage, this would require more complex S3 API calls
    // For now, return basic info
    return {
      totalFiles: 0,
      totalSize: 0,
      storageType: 'cloud',
      orgId,
      bucket: this.bucketName
    };
  }

  /**
   * Copy a file within storage
   */
  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    if (this.storageType === 'local') {
      const sourcePath = path.join(this.localStoragePath, sourceKey);
      const destPath = path.join(this.localStoragePath, destinationKey);
      
      try {
        // Ensure destination directory exists
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          await mkdir(destDir, { recursive: true });
        }

        const sourceBuffer = await readFile(sourcePath);
        await writeFile(destPath, sourceBuffer);
        
        this.logger.log(`File copied locally: ${sourceKey} -> ${destinationKey}`);
      } catch (error: any) {
        this.logger.error(`Failed to copy file locally: ${error.message}`);
        throw error;
      }
    } else {
      if (!this.s3) {
        throw new Error('Cloud storage not initialized');
      }

      try {
        const copyParams = {
          Bucket: this.bucketName,
          CopySource: `${this.bucketName}/${sourceKey}`,
          Key: destinationKey
        };

        await this.s3.copyObject(copyParams).promise();
        this.logger.log(`File copied in cloud: ${sourceKey} -> ${destinationKey}`);
      } catch (error: any) {
        this.logger.error(`Failed to copy file in cloud: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Get a presigned download URL
   */
  async getPresignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    return this.getPresignedUrl(key, expiresIn);
  }

  /**
   * List files in storage
   */
  async listFiles(prefix?: string, limit?: number): Promise<any[]> {
    if (this.storageType === 'local') {
      try {
        const searchPath = prefix ? path.join(this.localStoragePath, prefix) : this.localStoragePath;
        if (!fs.existsSync(searchPath)) {
          return [];
        }

        const files: any[] = [];
        const scanDir = (dirPath: string, relativePath: string = '') => {
          const items = fs.readdirSync(dirPath, { withFileTypes: true });
          for (const item of items) {
            if (files.length >= (limit || 1000)) break;
            
            if (item.isDirectory()) {
              scanDir(path.join(dirPath, item.name), path.join(relativePath, item.name));
            } else {
              const filePath = path.join(dirPath, item.name);
              const stats = fs.statSync(filePath);
              files.push({
                key: path.join(relativePath, item.name),
                size: stats.size,
                lastModified: stats.mtime,
                contentType: 'application/octet-stream'
              });
            }
          }
        };

        scanDir(searchPath, prefix || '');
        return files;
      } catch (error: any) {
        this.logger.error(`Failed to list local files: ${error.message}`);
        return [];
      }
    }

    if (!this.s3) {
      return [];
    }

    try {
      const params: any = {
        Bucket: this.bucketName,
        MaxKeys: limit || 1000
      };

      if (prefix) {
        params.Prefix = prefix;
      }

      const result = await this.s3.listObjectsV2(params).promise();
      return result.Contents?.map((obj: any) => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        etag: obj.ETag
      })) || [];
    } catch (error: any) {
      this.logger.error(`Failed to list cloud files: ${error.message}`);
      return [];
    }
  }
}