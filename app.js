var mongoUtil = require('./mongoUtil');
var mqttClient = require('./mqttHandler');

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
            //TODO: add the booking code when inserting into the collection
            appointments.insertOne(bookingResponse.bookingRequest);

            var appointmentDate = new Date(Date.parse(bookingResponse.bookingRequest.appointmentDate))
            //TODO: send the booking code to be displayed 
            //on the bookingResponse page
            let approveMessage = {
              "status": "Added",
              "message": "Your appointment has been made!",
              "info": "Appointment details have been sent to your email.",
              "date": appointmentDate.toDateString(),
              "time": appointmentDate.getHours() + ":" + appointmentDate.getMinutes(),
              "clinic": bookingResponse.bookingRequest.clinicName
            }

            console.log(approveMessage);

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
