const jwt = require('jsonwebtoken');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const User = require("../model/userModel");


const isAuthenticated = catchAsync(async (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization.split(" ")[1];

    if (!token) {
        return next(new AppError('you are not logged in.please login to access', 401))
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const currentUser = await User.findById(decoded.id);

    if (!currentUser) {
        return next(
            new AppError('the user doest not belong to the token does not Exist', 401)
        );
    }
    req.user = currentUser;
    next();
});

module.exports = isAuthenticated;