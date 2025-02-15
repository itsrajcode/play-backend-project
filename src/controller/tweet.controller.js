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

const updateTweet = asyncHandler(async (req, res, next) => {
  const { tweetId } = req.params;
  const { content } = req.body;
  const userId = req.user._id;
  if (!isValidObjectId(tweetId)) {
    return next(new ApiError(400, "Invalid twwetID "));
  }
  const tweet = await Tweet.findById(tweetId);
  if (!tweet) {
    return next(ApiError(404, "twwet not found"));
  }
  if (tweet.owner.toString() !== userId.toString()) {
    return next(new ApiError(403, "You can only update your own tweets"));
  }
  const updatedTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: {
        content,
      },
    },
    {
      new: true,
    }
  );
  if (!updatedTweet) {
    return next(new ApiError(500, "Something went wrong while updating tweet"));
  }
  return res
    .status(200)
    .json(new ApiResponse(200, "Tweet updated Successfully", updatedTweet));
});

const deleteTweet = asyncHandler(async (req, res, next) => {
  const tweetId = req.params;
  const userId = req.user._id;
  if (!isValidObjectId(tweetId)) {
    return next(new ApiError(400, "Invalid tweet ID"));
  }
  const tweet = await Tweet.findById(tweetId);
  if (!tweet) {
    return next(new ApiError(404, "Tweet not found"));
  }
  if (tweet.owner.toString() !== userId.toString()) {
    return next(new ApiError(403, "You can only delete your own tweets"));
  }
  const deletedTweet = await Tweet.findByIdAndDelete(tweetId);
  if (!deletedTweet) {
    return next(new ApiError(500, "Something went wrong while deleting tweet"));
  }
  return res
    .status(200)
    .json(new ApiResponse(200, "Tweet deleted successfully", deletedTweet));
});
export { createTweet, getTweets, updateTweet, deleteTweet };
