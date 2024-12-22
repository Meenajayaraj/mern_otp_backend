const mongoose = require('mongoose');
const dotenv = require("dotenv");

dotenv.config({ path: "./config.env" });
const app = require("./app");


//application to database

const db = process.env.DB
mongoose.connect(db).then(() => {
    console.log("DB connected successfully");
}).catch((err) => {
    console.log(err);
});

const port = process.env.PORT || 3000

app.listen(port, () => {
    console.log(`app running on port ${port}`);
});