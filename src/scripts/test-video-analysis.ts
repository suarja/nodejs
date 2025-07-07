#!/usr/bin/env ts-node

import { geminiService } from "../services/geminiService";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function testVideoAnalysis() {
  console.log("🧪 Testing Video Analysis Service");
  console.log("=".repeat(50));

  const videoRlrs = [
    "https://www.youtube.com/watch?v=JDi4IdtvDVE",
    "https://ai-edit-v1.s3.us-east-1.amazonaws.com/videos/f3d0be35-d766-4a4a-92bc-ae72614b9470/1751878002235_IMG_0007.MP4",
    "https://www.pexels.com/fr-fr/download/video/32801416/",
    "https://ai-edit-v1.s3.us-east-1.amazonaws.com/videos/f3d0be35-d766-4a4a-92bc-ae72614b9470/1750119764716_IMG_3716.MOV",
  ];
  // Test URL provided by user
  const testVideoUrl = videoRlrs[3] || "";

  console.log(`📹 Test Video URL: ${testVideoUrl}`);
  console.log(`🕐 Started at: ${new Date().toISOString()}`);

  try {
    // Test the analysis
    const startTime = Date.now();
    const result = await geminiService.analyzeVideoFromS3(testVideoUrl);
    const duration = Date.now() - startTime;

    console.log("\n" + "=".repeat(50));
    console.log("📊 ANALYSIS RESULTS");
    console.log("=".repeat(50));

    if (result.success) {
      console.log(`✅ Analysis successful in ${duration}ms`);
      console.log(`📝 Method used: ${result.method_used || "unknown"}`);

      if (result.data) {
        console.log("\n📄 VIDEO METADATA:");
        console.log(`   Title: ${result.data.title}`);
        console.log(`   Description: ${result.data.description}`);
        console.log(`   Tags: ${result.data.tags.join(", ")}`);
        console.log(`   Content Type: ${result.data.content_type}`);
        console.log(`   Language: ${result.data.language}`);
        console.log(`   Duration Category: ${result.data.duration_category}`);

        console.log("\n🏗️ VIDEO STRUCTURE:");
        console.log(`   Has Hook: ${result.data.structure.has_hook}`);
        console.log(`   Has CTA: ${result.data.structure.has_call_to_action}`);
        console.log(
          `   Transitions: ${result.data.structure.transitions_count}`
        );
        console.log(`   Pacing: ${result.data.structure.pacing}`);

        if (result.data.segments && result.data.segments.length > 0) {
          console.log("\n🎬 VIDEO SEGMENTS:");
          result.data.segments.forEach((segment, index) => {
            console.log(
              `   ${index + 1}. ${segment.start_time}-${segment.end_time}: ${
                segment.description
              }`
            );
          });
        }

        if (
          result.data.key_moments &&
          Object.keys(result.data.key_moments).length > 0
        ) {
          console.log("\n⏰ KEY MOMENTS:");
          Object.entries(result.data.key_moments).forEach(([key, value]) => {
            if (value) {
              console.log(`   ${key}: ${value}`);
            }
          });
        }
      }
    } else {
      console.log(`❌ Analysis failed: ${result.error}`);
    }
  } catch (error) {
    console.error("\n❌ Test failed with error:", error);
  }

  console.log("\n" + "=".repeat(50));
  console.log(`🏁 Test completed at: ${new Date().toISOString()}`);
}

// Environment check
function checkEnvironment() {
  console.log("🔍 Environment Check");
  console.log("-".repeat(30));

  const requiredEnvVars = [
    "GOOGLE_API_KEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_S3_BUCKET_NAME",
  ];

  const missing = requiredEnvVars.filter((env) => !process.env[env]);

  if (missing.length > 0) {
    console.log(`❌ Missing environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log("✅ All required environment variables present");
  console.log(`   Platform: ${process.platform}`);
  console.log(`   Node.js: ${process.version}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("");
}

// Main execution
async function main() {
  checkEnvironment();
  await testVideoAnalysis();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { testVideoAnalysis };
