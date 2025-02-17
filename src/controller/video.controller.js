import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    query = "",
    sortBy = "createdAt",
    sortType = "desc",
    userId,
  } = req.query;
  if (!req.user) {
    return next(new ApiError(401, "Unauthorized request"));
  }
  const match = {
    ...(query ? { title: { $regex: query, $options: "i" } } : {}),
    ...(userId ? { owner: mongoose.Types.ObjectId(userId) } : {}),
  };
  const videos = await Video.aggregate([
    {
      $match: match,
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "videosByOwner",
      },
    },
    {
      $project: {
        videoFile: 1,
        thumbnail: 1,
        title: 1,
        description: 1,
        duration: 1,
        views: 1,
        isPublished: 1,
        owner: {
          $arrayElemAt: ["$videosByOwner", 0],
        },
      },
    },
    {
      $sort: {
        [sortBy]: sortType === "desc" ? -1 : 1,
      },
    },

    {
      $skip: (page - 1) * parseInt(limit),
    },

    {
      $limit: parseInt(limit),
    },
  ]);
  if (!videos.length) {
    return next(new ApiError(404, "videos not found"));
  }
  return res
    .status(200)
    .json(new ApiResponse(200, "videos fetched successfully", videos));
});

export { getAllVideos };