var mongoUtil = require('./mongoUtil');
var mqttClient = require('./mqttHandler');
var nodemailer = require('nodemailer');


const client = mqttClient.getMQTTClient();

const topic = 'dentistimo/#' 
client.on('connect', () => {
  console.log('Connected')
  client.subscribe([topic], () => {
    console.log(`Subscribe to topic '${topic}'`)
})
    client.on('message', (topic, payload) => {

      if (topic === 'dentistimo/booking-handler') {
        console.log('Received Message:', topic, payload.toString())
      
      client.publish('dentistimo/booking-request', payload.toString(), { qos: 0, retain: false }, (error) => {
        if (error) {
          console.error(error)
        }
      })
      } else if (topic === 'dentistimo/booking-response') {
        var bookingResponse = JSON.parse(payload);

        if (bookingResponse.response === 'Approved') {
          mongoUtil.connectToServer(function (err) {
            if (err) console.log(err);
            const db = mongoUtil.getDb();
            const appointments = db.collection("appointments");
           
            let bookingCode = Math.random().toString(36).substring(2);
            let newRequest = {
              "clinicName": bookingResponse.bookingRequest.clinicName,
              "clinicId": bookingResponse.bookingRequest.clinicId,
              "appointmentDate": bookingResponse.bookingRequest.appointmentDate,
              "bookingCode": bookingCode,
              "firstname": bookingResponse.bookingRequest.firstname,
              "lastname": bookingResponse.bookingRequest.lastname,
              "email": bookingResponse.bookingRequest.email,
              "number": bookingResponse.bookingRequest.number,
              "description": bookingResponse.bookingRequest.description,
              }

            appointments.insertOne(newRequest);

            var appointmentDate = new Date(Date.parse(bookingResponse.bookingRequest.appointmentDate))
            let approveMessage = {
              "status": "Added",
              "message": "Your appointment has been made!",
              "info": "Appointment details have been sent to your email.",
              "date": appointmentDate.toDateString(),
              "time": appointmentDate.getHours() + ":" + appointmentDate.getMinutes(),
              "clinic": bookingResponse.bookingRequest.clinicName,
              "bookingCode": bookingCode
            }

            console.log(approveMessage);

            var transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: {
                user: 'dentistimoclinics@gmail.com',
                pass: 'dentistimo123'
              }
            });

            var mailOptions = {
              from: 'dentistimoclinics@gmail.com',
              to: 'turquis.amanda@gmail.com',
              subject: 'Booking Confirmation',
              text: "Your appointment has been made!" + " \n " + " \n "
              + "Clinic: " + bookingResponse.bookingRequest.clinicName + " \n " 
              + "Date: " +appointmentDate.toDateString() + " \n " 
              + "Time: " + appointmentDate.getHours() + ":" + appointmentDate.getMinutes() + " \n " 
              + "Booking code: " + bookingCode
            };
            
            transporter.sendMail(mailOptions, function(error, info){
              if (error) {
                console.log(error);
              } else {
                console.log('Email sent: ' + info.response);
              }
            });

            client.publish('dentistimo/ui-booking-response', JSON.stringify(approveMessage), { qos: 0, retain: false }, (error) => {
              if (error) {
                console.error(error)
              }
            })
          });
        } else {
          console.log('Rejected');

          let rejectMessage = {
            "status": "Rejected",
            "message": "Sorry, this time was not available. Please try another time slot."
          }
          
          client.publish('dentistimo/ui-booking-response', JSON.stringify(rejectMessage), { qos: 0, retain: false }, (error) => {
            if (error) {
              console.error(error)
            }
          })
        }
      }
      
    })
  })
