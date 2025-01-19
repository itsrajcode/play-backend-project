import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiRrsponse.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";

const registerUser = asyncHandler(async (req, res, next) => {
  const { username, email, fullname, password, avatar, coverImage } = req.body;

  if (!username || !email || !fullname || !password || !avatar) {
    return next(new ApiError(400, "Please provide all fields"));
  }

  const userExists = await User.findOne({ $or: [{ username }, { email }] });

  if (userExists) {
    return next(new ApiError(409, "User already exists"));
  }

  const avatarLocalpath = res.files?.avatar[0]?.path;
  const coverImageLocalpath = res.files?.coverImage[0]?.path;

  if (!avatarLocalpath) {
    return next(new ApiError(400, "Please provide avatar"));
  }

  const avatarUrl = await uploadOnCloudinary(avatarLocalpath);
  const coverImageUrl = await uploadOnCloudinary(coverImageLocalpath);

  if (!avatarUrl || !coverImageUrl) {
    return next(new ApiError(400, "Error uploading image"));
  }

  const user = await User.create({
    username:username.toLowerCase(),
    email,
    fullname,
    password,
    avatar: avatarUrl.url,
    coverImage: coverImageUrl.url || "",
  });
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    return next(new ApiError(500, "Error while creating user"));
  }
 return res.status(201).json({
   new ApiResponse(200, "User created successfully", createdUser)
 })
});

export { registerUser };
