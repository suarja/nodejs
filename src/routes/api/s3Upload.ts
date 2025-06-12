import { Request, Response } from 'express';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_BUCKET_NAME } from '../../config/aws';
import { ClerkAuthService } from '../../services/clerkAuthService';

export async function uploadS3Handler(req: Request, res: Response) {
  try {
    console.log('🔐 S3 upload request received');
    // Step 1: Authenticate user using ClerkAuthService
    const authHeader = req.headers.authorization;
    const { user, clerkUser, errorResponse: authError } = await ClerkAuthService.verifyUser(
      authHeader
    );
    console.log('🔐 User authenticated for S3 upload - DB ID:', user?.id, 'Clerk ID:', clerkUser?.id);

    if (authError) {
      return res.status(authError.status).json(authError);
    }

    const { fileName, fileType } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({
        success: false,
        error: 'fileName and fileType are required',
      });
    }

    // Generate unique file name with user ID for organization
    const timestamp = Date.now();
    const uniqueFileName = `videos/${user!.id}/${timestamp}_${fileName}`;

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

    console.log(`📦 S3 upload URL generated for user ${user!.id}: ${uniqueFileName}`);

    return res.status(200).json({
      success: true,
      data: {
        presignedUrl,
        publicUrl,
        fileName: uniqueFileName,
        userId: user!.id, // Return database user ID for frontend reference
      },
    });
  } catch (error) {
    console.error('❌ S3 upload error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate upload URL',
    });
  }
}
