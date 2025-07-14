import express from "express";
import { ClerkAuthService } from "../../services/clerkAuthService";


const userManagementRouter = express.Router();

userManagementRouter.post("/delete-user", async (req, res) => {
try {
    const { success, error } = await ClerkAuthService.deleteUser(req.headers.authorization);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error });
  }
});

export default userManagementRouter;