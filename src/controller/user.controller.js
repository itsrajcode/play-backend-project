import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.refreshAccessToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return {
      accessToken: accessToken,
      refreshToken: refreshToken,
    };
  } catch (error) {
    throw new ApiError(500, "Error generating access and refresh token");
  }
};

const registerUser = asyncHandler(async (req, res, next) => {
  const { username, email, fullName, password } = req.body;
  const avatarFile = req.files?.avatar?.[0];
  let coverImageFile;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageFile = req.files.coverImage[0];
  }

  if (!username || !email || !fullName || !password || !avatarFile) {
    return next(new ApiError(400, "Please provide all required fields"));
  }

  const userExists = await User.findOne({
    $or: [{ username: username.toLowerCase() }, { email }],
  });

  if (userExists) {
    return next(new ApiError(409, "User already exists"));
  }

  const avatarLocalpath = avatarFile.path;
  const coverImageLocalpath = coverImageFile?.path;

  const avatarResponse = await uploadOnCloudinary(avatarLocalpath);
  const coverImageResponse = coverImageLocalpath
    ? await uploadOnCloudinary(coverImageLocalpath)
    : null;

  if (!avatarResponse) {
    return next(new ApiError(400, "Error uploading avatar"));
  }

  const user = await User.create({
    username: username.toLowerCase(),
    email,
    fullName,
    password,
    avatar: avatarResponse.url,
    coverImage: coverImageResponse?.url || "",
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    return next(new ApiError(500, "Error while retrieving created user"));
  }

  return res
    .status(201)
    .json(new ApiResponse(201, "User created successfully", createdUser));
});

const loginUser = asyncHandler(async (req, res, next) => {
  const { email, username, password } = req.body;

  if (!(username || email)) {
    return next(new ApiError(400, "username or email is required"));
  }
  if (!password) {
    return next(new ApiError(400, "password is required"));
  }

  const user = await User.findOne({
    $or: [{ username: username.toLowerCase() }, { email }],
  });

  if (!user) {
    return next(new ApiError(404, "User not found"));
  }

  if (!user.isPasswordCorrect(password)) {
    return next(new ApiError(401, "Incorrect password"));
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );
  const userWithToken = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(200, "User logged in successfully", {
        user: userWithToken,
        accessToken,
        refreshToken,
      })
    );
});

const logoutUser = asyncHandler(async (req, res, next) => {
  User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res, next) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.headers["x-refresh-token"];
  if (!incomingRefreshToken) {
    return next(new ApiError(401, "Refresh token is required"));
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id).select("-password");
    if (!user) {
      return next(new ApiError(401, "Invalid refresh token"));
    }
    const options = {
      httpOnly: true,
      secure: true,
    };
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(200, "Refresh token is valid", {
          accessToken,
          user,
        })
      );
  } catch (error) {
    return next(new ApiError(401, "Invalid refresh token"));
  }
});

const changeCurrentPassword = asyncHandler(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return next(new ApiError(400, "Please provide old and new password"));
  }
  if (newPassword === oldPassword) {
    return next(
      new ApiError(400, "New password cannot be same as old password")
    );
  }
  const user = await User.findById(req.user?._id);
  if (!user) {
    return next(new ApiError(404, "User not found"));
  }
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    return next(new ApiError(400, "Incorrect old password"));
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res, next) => {
  return res
    .status(200)
    .json(new ApiResponse(200, "User fetched succussfully", req.user));
});
const updateAccountDetails = asyncHandler(async (req, res, next) => {
  const { username, email, fullName } = req.body;
  if (!username || !email || !fullName) {
    return next(new ApiError(400, "Please provide all required fields"));
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { username: username.toLowerCase(), email, fullName },
    },
    {
      new: true,
      runValidators: true,
    }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, "Account details updated successfully", user));
});

const updateAvatar = asyncHandler(async (req, res, next) => {
  const avatarLocalpath = req.file?.path;
  if (!avatarLocalpath) {
    return next(new ApiError(400, "avatar file is missing"));
  }
  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { avatar: "" },
    },
    {
      new: true,
    }
  );
  const avatar = await uploadOnCloudinary(avatarLocalpath);
  if (!avatar.url) {
    return next(new ApiError(400, "Error uploading avatar"));
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { avatar: avatar.url },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, "Avatar updated successfully", user));
});

const updateCoverImage = asyncHandler(async (req, res, next) => {
  const coverImageLocalpath = req.file?.path;
  if (!coverImageLocalpath) {
    return next(new ApiError(400, "cover image file is missing"));
  }
  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { coverImage: "" },
    },
    {
      new: true,
    }
  );
  const coverImage = await uploadOnCloudinary(coverImageLocalpath);
  if (!coverImage.url) {
    return next(new ApiError(400, "Error uploading cover image"));
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { coverImage: coverImage.url },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, "Cover image updated successfully", user));
});

const getUserChannelProfile = asyncHandler(async (req, res, next) => {
  const { username } = req.params;
  if (!username?.trim()) {
    return next(new ApiError(400, "Please provide username"));
  }
  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribeTo",
      },
    },
    {
      $addFields: {
        subscribersCount: { $size: "$subscribers" },
        subscribeToCount: { $size: "$subscribeTo" },
        isSubscribed: {
          $cond: {
            if: {
              $in: [req.user?._id, "$subscribers.subscriber"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        avatar: 1,
        coverImage: 1,
        subscribersCount: 1,
        subscribeToCount: 1,
        isSubscribed: 1,
      },
    },
  ]);
  if (!channel || channel.length === 0) {
    return next(new ApiError(404, "Channel not found"));
  }
  return res
    .status(200)
    .json(new ApiResponse(200, "Channel fetched successfully", channel[0]));
});

const getWatchHistory = asyncHandler(async (req, res, next) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                    subscriber: 1,
                    subscribeTo: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: { $first: "$owner" },
            },
          }
        ],
      },
    },
  ]);
  return res
    .status(200)
    .json(new ApiResponse(200, "Watch history fetched successfully", user[0].watchHistory));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateAvatar,
  updateCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};