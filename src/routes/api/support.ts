import express from "express";
import { ClerkAuthService } from "../../services/clerkAuthService";

const supportRouter = express.Router();

interface ReportIssueBody {
  jobId: string;
  errorMessage?: string;
  userMessage?: string;
  deviceInfo?: {
    brand?: string;
    manufacturer?: string;
    modelName?: string;
    osName?: string;
    osVersion?: string;
    appVersion?: string;
  };
  context?: Record<string, any>;
}

// POST /api/support/report-issue
supportRouter.post("/report-issue", async (req, res) => {
  console.log("📨 Received support issue report request");
  try {
    // 1. Authenticate the user
    const authHeader = req.headers.authorization;
    const { user, clerkUser, errorResponse } =
      await ClerkAuthService.verifyUser(authHeader);

    if (errorResponse) {
      return res.status(errorResponse.status).json(errorResponse);
    }

    const {
      jobId,
      errorMessage,
      userMessage,
      deviceInfo,
      context,
    }: ReportIssueBody = req.body;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: "jobId is required",
      });
    }

    // 2. Prepare to call the web mailing service
    const webAppUrl = process.env.WEB_APP_URL || "http://localhost:3000";
    const mailerEndpoint = `${webAppUrl}/api/support/notify`;

    console.log(`📧 Forwarding issue report to mailer: ${mailerEndpoint}`);
    console.log("📱 Device info:", deviceInfo);
    console.log("🔍 Context:", context);

    const mailPayload = {
      userId: user?.id,
      userEmail: clerkUser?.emailAddresses[0]?.emailAddress,
      jobId,
      errorMessage,
      userMessage,
      deviceInfo,
      context,
      timestamp: new Date().toISOString(),
    };

    // 3. Fire-and-forget call to the mailer service
    fetch(mailerEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Service-Secret": process.env.INTERNAL_SERVICE_SECRET || "",
      },
      body: JSON.stringify(mailPayload),
    }).catch((mailError) => {
      console.error("❌ Failed to send issue report to mailer:", mailError);
    });

    // 4. Respond to the user immediately
    return res.status(202).json({
      success: true,
      message: "Issue report has been queued for sending.",
    });
  } catch (error: any) {
    console.error("❌ Error processing issue report:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error while processing the report.",
      details: error.message,
    });
  }
});

export default supportRouter;
