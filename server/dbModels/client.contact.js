const mongoose = require('mongoose');

const assistSchema = new mongoose.Schema({
    name:String,
    email:String,
    message:String
})

module.exports = mongoose.model('clientNotes', assistSchema)