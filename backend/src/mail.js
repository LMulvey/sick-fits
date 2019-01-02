const nodemailer = require("nodemailer");

const transport = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

const makeANiceEmail = text => `
  <div class="email" style="
    border: 1px solid black;
    padding: 20px;
    front-family: sans-serif;
    line-height: 2;
    font-size: 24px;
  ">
    <h2>Hey you!</h2>
    <p>${text}</p>

    <p>From, Sick Fits 👩‍🚒</p>
  </div>
`;

exports.transport = transport;
exports.makeANiceEmail = makeANiceEmail;
