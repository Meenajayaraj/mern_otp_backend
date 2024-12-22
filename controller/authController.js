const { options } = require("../app");
const User = require("../model/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const sendEmail = require("../utils/email");
const generateOtp = require("../utils/generateOtp");
const jwt = require("jsonwebtoken");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createsendToken = (user, statusCode, res, message) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // secure in production
    sameSite: process.env.NODE_ENV === "production" ? "none" : "Lax",
  };

  res.cookie("token", token, cookieOptions);

  // Remove sensitive information
  user.password = undefined;
  user.passwordconfirm = undefined;
  user.otp = undefined;

  res.status(statusCode).json({
    status: "success",
    message,
    token,
    data: {
      user,
    },
  });
};

// SIGN UP
exports.signup = catchAsync(async (req, res, next) => {
  const { email, password, passwordconfirm, username } = req.body;
  const existingUser = await User.findOne({ email });

  if (existingUser) return next(new AppError("Email already registered", 400));

  const otp = generateOtp();
  const otpExpires = Date.now() + 24 * 60 * 60 * 1000;

  const newUser = await User.create({
    username,
    email,
    password,
    passwordconfirm,
    otp,
    otpExpires,
  });

  try {
    await sendEmail({
      email: newUser.email,
      subject: "OTP for email verification",
      html: `<h1>Your OTP is: ${otp}</h1>`,
    });

    createsendToken(newUser, 200, res, "Registration successful");
  } catch (error) {
    console.error("Error while sending email:", error);
    await User.findByIdAndDelete(newUser.id); // Rollback user creation
    return next(
      new AppError("There was an error sending the email. Try again", 500)
    );
  }
});

// VERIFY ACCOUNT
exports.verifyAccount = catchAsync(async (req, res, next) => {
  const { otp } = req.body;

  if (!otp) {
    return next(new AppError("OTP is missing", 400));
  }

  const user = req.user || (await User.findById(req.user.id));

  if (!user) return next(new AppError("User not found", 404));

  if (user.otp !== otp) {
    return next(new AppError("Invalid OTP", 400));
  }

  if (Date.now() > user.otpExpires) {
    return next(new AppError("OTP has expired. Please request a new OTP", 400));
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;

  await user.save({ validateBeforeSave: false });

  createsendToken(user, 200, res, "Email has been verified.");
});

// RESEND OTP
exports.resendOTP = catchAsync(async (req, res, next) => {
  const { email } = req.user;

  if (!email) {
    return next(new AppError("Email is required to resend OTP", 400));
  }

  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  if (user.isVerified) {
    return next(new AppError("This account is already verified", 400));
  }

  const newOtp = generateOtp();
  user.otp = newOtp;
  user.otpExpires = Date.now() + 24 * 60 * 60 * 1000;

  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({
      email: user.email,
      subject: "Resend OTP for email verification",
      html: `<h1>Your new OTP is: ${newOtp}</h1>`,
    });

    res.status(200).json({
      status: "success",
      message: "A new OTP has been sent to your email",
    });
  } catch (error) {
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        "There was an error sending the email. Please try again",
        500
      )
    );
  }
});

// LOGIN
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError("Please provide email and password", 400));
  }

  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

  createsendToken(user, 200, res, "Login successful");
});

// LOGOUT
exports.logout = catchAsync(async (req, res, next) => {
  res.cookie("token", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000), // Fixed expiration time
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  res.status(200).json({
    status: "success",
    message: "Logged out successfully",
  });
});

// FORGOT PASSWORD
exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return next(new AppError("No user found", 404));
  }

  const otp = generateOtp();
  user.resetPasswordOTP = otp;
  user.resetPasswordOTPExpires = Date.now() + 5 * 60 * 1000; // 5 minutes

  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({
      email: user.email,
      subject: "Your password reset OTP (valid for 5 minutes)",
      html: `<h1>Your password reset OTP: ${otp}</h1>`,
    });

    res.status(200).json({
      status: "success",
      message: "Password reset OTP has been sent to your email",
    });
  } catch (error) {
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        "There was an error sending the email. Please try again later.",
        500
      )
    );
  }
});

// RESET PASSWORD
exports.resetPassword = catchAsync(async (req, res, next) => {
  const { email, otp, password, passwordconfirm } = req.body;
  const user = await User.findOne({
    email,
    resetPasswordOTP: otp,
    resetPasswordOTPExpires: { $gt: Date.now() },
  });

  if (!user) return next(new AppError("No user found", 400));

  user.password = password;
  user.passwordconfirm = passwordconfirm;
  user.resetPasswordOTP = undefined;
  user.resetPasswordOTPExpires = undefined;

  await user.save();

  createsendToken(user, 200, res, "Password reset successfully");
});
