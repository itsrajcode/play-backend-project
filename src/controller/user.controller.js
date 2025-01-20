import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";

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

export { registerUser };