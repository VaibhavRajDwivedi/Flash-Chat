import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { createGroup, getMyGroups ,toggleGroupAdmin, removeMember, addMembers, leaveGroup } from "../controllers/group.controller.js";

const router = express.Router();

router.post("/create", protectRoute, createGroup);
router.get("/", protectRoute, getMyGroups);
router.put("/toggle-admin", protectRoute, toggleGroupAdmin);
router.put("/remove-member", protectRoute, removeMember);
router.put("/add-members", protectRoute, addMembers);
router.put("/leave", protectRoute, leaveGroup);

export default router;