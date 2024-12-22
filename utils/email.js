const nodemailer = require("nodemailer");


const sendMail = async (options) => {
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        }
    })
    const mailOptions = {
        from: `"Capstone Project"<sundharaj2517@gmail.com>`,
        to: options.email,
        subject: options.subject,
        html: options.html,
    };
    await transporter.sendMail(mailOptions);
};
module.exports = sendMail;