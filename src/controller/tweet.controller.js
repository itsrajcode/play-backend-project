import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res, next) => {
  const { content } = req.body;
  if (!content) {
    return next(new ApiError(400, "Content is required"));
  }
  const newtweet = await Tweet.create({
    content,
    user: req.user._id,
  });
  if (!newtweet) {
    return next(new ApiError(500, "Tweet could not be created"));
  }
  return res.status(201).json(new ApiResponse(201, "Tweet created", newtweet));
});

const getTweets = asyncHandler(async (req, res, next) => {
  const userId = req.params;
  if (!isValidObjectId(userId)) {
    return next(new ApiError(400, "Invalid user id"));
  }
  const tweets = await Tweet.find({ owner: userId }).sort({ createdAt: -1 });
  if (!tweets || tweets.length === 0) {
    return next(new ApiError(404, "No tweets found"));
  }
  return res
    .status(200)
    .json(new ApiResponse(200, "Tweets fetched successfully", tweets));
});

export { createTweet, getTweets };
