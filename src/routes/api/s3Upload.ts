import { Request, Response } from 'express';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_BUCKET_NAME } from '../../config/aws';

export async function uploadS3Handler(req: Request, res: Response) {
  try {
    const { fileName, fileType } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({
        error: 'fileName and fileType are required',
      });
    }

    // Generate unique file name
    const timestamp = Date.now();
    const uniqueFileName = `videos/${timestamp}_${fileName}`;

    // Create presigned URL for upload
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: uniqueFileName,
      ContentType: fileType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour
    });

    // Public URL for accessing the file after upload
    const publicUrl = `https://${S3_BUCKET_NAME}.s3.amazonaws.com/${uniqueFileName}`;

    console.log(`📦 S3 upload URL generated: ${uniqueFileName}`);

    return res.status(200).json({
      presignedUrl,
      publicUrl,
      fileName: uniqueFileName,
    });
  } catch (error) {
    console.error('❌ S3 upload error:', error);
    return res.status(500).json({
      error: 'Failed to generate upload URL',
    });
  }
}
