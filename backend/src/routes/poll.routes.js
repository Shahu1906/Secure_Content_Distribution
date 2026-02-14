import express from "express";

import {
  createPoll,
  votePoll,
  getPolls,
} from "../controllers/poll.controller.js";

import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/create", verifyToken, createPoll);
router.post("/vote", verifyToken, votePoll);
router.get("/:classId", verifyToken, getPolls);

export default router;
