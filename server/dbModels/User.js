const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userName:{
        type:String,
        required:true,
        unique:true
    },
    image:{
        data:Buffer,
        contentType:String
    },
    password:{ 
        type:String,
        required:true,
    }, 
            email:{
                type:String,
                required:true
            },
            adress:{
                country:{
                    type:String,
                    reqiored:true
                },
                city:{
                    type:String,
                    require:true
                },
                street:{
                    type:String,
                    required:true
                },
                zip_code:{
                    type:Number,
                    required:true,
                }
            }
            });


            module.exports =  mongoose.model('USER', userSchema)