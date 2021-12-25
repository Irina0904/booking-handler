//Module to connect to MongoDB in from other files
const MongoClient = require('mongodb').MongoClient;
const uri = 'mongodb+srv://IriLev0904:Tuborg2002@cluster0.nkjyt.mongodb.net/WebProject?retryWrites=true&w=majority'


var _db;

module.exports = {

  connectToServer: function( callback ) {
    MongoClient.connect( uri,  {useUnifiedTopology: true }, function( err, client ) {
        _db = client.db();
      return callback( err );
    } );
  },

  getDb: function() {
    return _db;
  }
};