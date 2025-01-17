import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";

const registerUser = asyncHandler(async (req, res, next) => {
  const { username, email, fullname, password, avatar } = req.body;

  if ((!username || !email || !fullname || !password || !avatar)) {
    return next(new ApiError(400, "Please provide all fields"));
  }

  const userExists =
    (await User.findOne({ email })) || (await User.findOne({ username }));

  if (userExists) {
    return next(new ApiError(400, "User already exists"));
  }

  const user = await User.create({ username, email, fullname, password, avatar });
  user.password = undefined;

  res.status(201).json({
    success: true,
    message: "User created successfully",
    data: user,
  });
});

export { registerUser };
