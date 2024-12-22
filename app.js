const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const globalErrorHandler = require('./controller/errorController');
const userRouter = require("./routes/userRouter");
const app = express();

app.use(cookieParser());

app.use(cors({
    origin: "http://localhost:3000",
    credentials: true,
})
);
app.use(express.json({ limit: "10kb" }));
// users api urls

app.use('/api/v1/users', userRouter);
app.all('*', (req, res, next) => {
    next(new AppError(`can't find ${req.originalUrl}on this server!`, 404));
});

app.use(globalErrorHandler);
module.exports = app;