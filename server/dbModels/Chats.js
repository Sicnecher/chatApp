const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    input:String,
    date: String,
    from:String
  });

const archiveSchema = new mongoose.Schema({
      userName: String,
      room:String,
      image:String,
      _id: mongoose.Schema.Types.ObjectId,
    messages: [messageSchema]
  });

  const chatsSchema = new mongoose.Schema({
    owner:String,
    image:String,
    chats:[archiveSchema]
  });


  module.exports =  mongoose.model('CHATS', chatsSchema)