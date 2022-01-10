var mongoUtil = require('./mongoUtil');
var mqttClient = require('./mqttHandler');
//var nodemailer = require('nodemailer');


const client = mqttClient.getMQTTClient();

const topic = 'dentistimo/#'
client.on('connect', () => {
  console.log('Connected')
  client.subscribe([topic], () => {
    console.log(`Subscribe to topic '${topic}'`)
  })
  client.on('message', (topic, payload) => {

    mongoUtil.connectToServer(function (err) {
      if (err) console.log(err);
      const db = mongoUtil.getDb();
      const appointments = db.collection("appointments");

      if (topic === 'dentistimo/new-request') {

        var nRequest = payload.toString();
        console.log('Received Message:', topic, nRequest);

        client.publish('dentistimo/new-booking-request', nRequest, { qos: 0, retain: false }, (error) => {
          if (error) {
            console.error(error)
          }
        })
      } else if (topic === 'dentistimo/send-booking-response') {
        var bookingResponse = JSON.parse(payload);

        if (bookingResponse.response === 'Approved') {

          let bookingCode = Math.random().toString(36).substring(2);
          let newRequest = {
            "clinicName": bookingResponse.bookingRequest.clinicName,
            "clinicId": bookingResponse.bookingRequest.clinicId,
            "appointmentDate": bookingResponse.bookingRequest.appointmentDate,
            //"bookingCode": Math.random().toString(36).substring(2),
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
            "clinic": bookingResponse.bookingRequest.clinicName
            //"bookingCode": newRequest.bookingCode
          }

          console.log(approveMessage);

          client.publish('dentistimo/ui-booking-response', JSON.stringify(approveMessage), { qos: 0, retain: false }, (error) => {
            if (error) {
              console.error(error)
            }
          })
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
      } else if (topic === "dentistimo/check-appointment") {
        appointments
          .find({ "bookingCode": payload.toString() })
          .toArray()
          .then((result) => {
            console.log(result);

            if (result[0] != null) {

              client.publish('dentistimo/check-appointment-response', JSON.stringify(result), { qos: 0, retain: false }, (error) => {
                if (error) {
                  console.error(error)
                }
              })
            } else {
              console.log("Booking code not found");
              let notFoundMessage = {
                "status": "Rejected",
                "message": "Sorry, your appointment has not been found. Please try with a different booking code or contact us."
              }
              client.publish('dentistimo/check-appointment-response', JSON.stringify(notFoundMessage), { qos: 0, retain: false }, (error) => {
                if (error) {
                  console.error(error)
                }
              })
            }
          });

      } else if (topic === 'dentistimo/bookingCode') {
        console.log('Booking Code received for deletion')
        var receivedBC = JSON.parse(payload);
        console.log('Received Booking Code:', receivedBC)
  
        appointments.findOneAndDelete({ bookingCode: receivedBC }, function (err) {
          if (err) {
            console.log(err);
          } else {
            console.log("Successfully deleted the appointment")
          }
        })
      }
  
    })
  })
})
