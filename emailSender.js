var nodemailer = require('nodemailer');

module.exports = {
    sendEmail: function(to, subject, text) {
    var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'dentistimoclinics@gmail.com',
      pass: 'dentistimo123'
    }
  });

  var mailOptions = {
    from: 'dentistimoclinics@gmail.com',
    to: to,
    subject: subject,
    text: text
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

}
