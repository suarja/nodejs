import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
export const S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "ai-edit-v1";

if (!AWS_ACCESS_KEY_ID) {
  console.warn("⚠️  AWS_ACCESS_KEY_ID environment variable not set");
}

if (!AWS_SECRET_ACCESS_KEY) {
  console.warn("⚠️  AWS_SECRET_ACCESS_KEY environment variable not set");
}

// Create S3 client (will be created even without credentials for graceful degradation)
export const s3Client = new S3Client({
  region: AWS_REGION,
  ...(AWS_ACCESS_KEY_ID &&
    AWS_SECRET_ACCESS_KEY && {
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    }),
});

// Test S3 connection
export async function testS3Connection(): Promise<boolean> {
  try {
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      console.warn(
        "⚠️  AWS credentials not configured - S3 features will be disabled"
      );
      return false;
    }

    // Simple test to list buckets (this requires minimal permissions)
    const command = new ListBucketsCommand({});
    await s3Client.send(command);

    console.log("✅ S3 connection successful");
    return true;
  } catch (error) {
    console.error("❌ S3 connection test failed:", error);
    return false;
  }
}

export const AWS_CONFIG = {
  region: AWS_REGION,
  bucket: S3_BUCKET_NAME,
};
