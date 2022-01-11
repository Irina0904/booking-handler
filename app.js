var mongoUtil = require('./mongoUtil');
var mqttClient = require('./mqttHandler');
var emailSender = require('./emailSender');


const client = mqttClient.getMQTTClient();

const topic = 'dentistimo/#'
client.on('connect', () => {
  console.log('Connected')
  client.subscribe([topic], { qos: 1 }, () => {
    console.log(`Subscribe to topic '${topic}'`)
  })
  client.on('message', (topic, payload) => {

    mongoUtil.connectToServer(function (err) {
      if (err) console.log(err);
      const db = mongoUtil.getDb();
      const appointments = db.collection("appointments");

      if (topic === 'dentistimo/new-request') {

        var newBookingRequest = payload.toString();
        console.log('Received Message:', topic, newBookingRequest);

        client.publish('dentistimo/new-booking-request', newBookingRequest, { qos: 1, retain: false }, (error) => {
          if (error) {
            console.error(error)
          }
        })
      } else if (topic === 'dentistimo/send-booking-response') {
        var bookingResponse = JSON.parse(payload);

        if (bookingResponse.response === 'Approved') {

          let newRequest = {
            "clinicName": bookingResponse.bookingRequest.clinicName,
            "clinicId": bookingResponse.bookingRequest.clinicId,
            "appointmentDate": bookingResponse.bookingRequest.appointmentDate,
            "bookingCode": Math.random().toString(36).substring(2),
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
            "bookingCode": newRequest.bookingCode
          }

          console.log(approveMessage);

          client.publish('dentistimo/ui-booking-response', JSON.stringify(approveMessage), { qos: 1, retain: false }, (error) => {
            if (error) {
              console.error(error)
            }
          })

          var bookingDetails = "Your appointment has been made!" + " \n " + " \n "
          + "Clinic: " + bookingResponse.bookingRequest.clinicName + " \n "
          + "Date: " + appointmentDate.toDateString() + " \n "
          + "Time: " + appointmentDate.getHours() + ":" + appointmentDate.getMinutes() + " \n "
            + "Booking code: " + newRequest.bookingCode
          
          emailSender.sendEmail(bookingResponse.bookingRequest.email,'Booking Confirmation', bookingDetails);
        
        } else {
          console.log('Rejected');

          let rejectMessage = {
            "status": "Rejected",
            "message": "Sorry, this time was not available. Please try another time slot."
          }

          client.publish('dentistimo/ui-booking-response', JSON.stringify(rejectMessage), { qos: 1, retain: false }, (error) => {
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
            //console.log(result);

            if (result[0] != null) {

              client.publish('dentistimo/check-appointment-response', JSON.stringify(result), { qos: 1, retain: false }, (error) => {
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
      } else if (topic === 'dentistimo/appointment-cancellation') {
      console.log('Booking Code received for deletion')
      var receivedBC = JSON.parse(payload);
        console.log('Received Booking Code:', receivedBC)
        
        appointments.find({ bookingCode: receivedBC }).toArray()
          .then((result) => {
            console.log(result[0].email);
            var userEmail = result[0].email;
            var clinic = result[0].clinicName;
            var date = new Date(Date.parse(result[0].appointmentDate))
           appointments.findOneAndDelete({ bookingCode: receivedBC }, function (err) {
        if (err) {
          console.log(err);
        } else {
          console.log("Successfully deleted the appointment");
          var cancellationEmail = "Your dentist appointment has been cancelled!" + " \n " + " \n "
            + "Clinic: " + clinic + " \n "
            + "Date: " + date.toDateString() + " \n "
            + "Time: " + date.getHours() + ":" + date.getMinutes() + " \n " + "Booking code: " + receivedBC;
          
          emailSender.sendEmail(userEmail,'Appointment cancellation', cancellationEmail);
        }
      })
          });

      
      

    }
      })
  })
})
