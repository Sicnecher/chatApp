const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');

require('dotenv').config();
const cookieParser = require('cookie-parser');


const connectDB = mongoose.connect('mongodb://127.0.0.1:27017/WhatApp');

const messageSchema = new mongoose.Schema({
    input:String,
    date: Date,
    from:String
  })

const archiveSchema = new mongoose.Schema({
      userName: String,
      _id: mongoose.Schema.Types.ObjectId,
    messages: [messageSchema]
  });

  const chatsSchema = new mongoose.Schema({
    owner:String,
    chats:[archiveSchema]
  })


const userSchema = new mongoose.Schema({
    userName:{
        type:String,
        required:true,
        unique:true
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

        const USER = new mongoose.model('USER', userSchema);
        const CHATS = new mongoose.model('CHATS', chatsSchema);



const app = express()


app.use(
    bodyParser.json(),
    bodyParser.urlencoded({ extended: false }),
    express.static('client/build'),
    cors(),
);

app.use(cookieParser());


const path = require('path');

function locateContact(chats, chatToFind){
    for(let i = 0; i<chats.length; i++){
        if(chats[i].userName == chatToFind){
            return i
        }
    }
}


app.get('/api/user', (req, res) => {
    try{
    const token = req.cookies.user
    if(token){
        res.send(token);
    }else{
        res.json(null);
    }
  }catch(e){
    console.log(e.message);
    res.status(500).send('Server error');
  };
});



app.get('/api/getChats', async (req, res) => {
    try{
        const user = req.cookies.user
        if(user){
        const chat = await CHATS.findOne({owner:user.userName});
        console.log(chat)
        res.send(chat)
        }else{
        res.send(null)
        }
    }catch(err){
        console.log(err.message)
    }
});



app.post('/api/submitMessage', async (req, res) => {
    const referer = req.get('Referer');

    const contactChats = await CHATS.findOne({owner:req.query.name})
    const userChats = await CHATS.findOne({owner:req.cookies.user.userName})
    const message = {
        input:req.body.message,
        date: new Date(),
        from:userChats.owner
    }

    const hasContact = contactChats.chats.some(chat => chat.userName === userChats.owner)

    if(!hasContact){
        const newChat = {
            userName:userChats.owner,
            _id:userChats._id,
        messages:[]
    }

        await contactChats.chats.push(newChat)
        await contactChats.save()
    }

    const userChatIndex = locateContact(userChats.chats, contactChats.owner);
    const contactChatIndex = locateContact(contactChats.chats, userChats.owner);

    await contactChats.chats[contactChatIndex].messages.push(message);
    await userChats.chats[userChatIndex].messages.push(message);
    await contactChats.save();
    await userChats.save();


    res.redirect(referer);
});





app.post('/api/searchUsers', async (req, res) => {

    const result = await USER.find(
        {
            $and:[
                {
            userName:{
                $regex: req.body.userName,
                $options: 'i'
            }
        },
        {
            userName: {
                $ne: req.body.personalUser.userName
              }
        }
    ]
},'userName')
    .limit(6)
    .then((result) => {
        res.send(result)
    })
    .catch((err) => {
        console.log(err.message);
        res.status(400);
    })
});




app.post('/api/addChat', async (req, res) => {
    const newChat = await USER.findOne({userName: req.body.chatUserName}, 'userName');
    const userChats = await CHATS.findOne({owner:req.cookies.user.userName}) 
    console.log(userChats)
    const chat = {
                userName:newChat.userName,
                _id:newChat._id,
            messages:[]
        }

    userChats.chats.push(chat)
    userChats.save().then(() => {
        res.send(userChats)
    })
});


app.get('*', async (req, res) => {
    try{
        res.cookie('nothing', {nothing:'nothing'})
        res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
    }catch(err){
        console.log(err.message)
    }
});


app.post('/signUp', async (req, res) => {
    try{
        bcrypt.hash(req.body.password, 10, async (err, hash) => {
           const newUser =  new USER({
                userName:req.body.userName,
                password:hash,
                email:req.body.email,
                adress:{
                    country:req.body.country,
                    city:req.body.city,
                    street:req.body.street,
                    zip_code:req.body.zipCode
                }
            });

            const newChat = new CHATS({
                owner:req.body.userName,
                chats:[]
            })

            await newChat.save()
            await newUser.save()
            if(err){
                console.log(err)
            }else{
                res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
            }
        });
    }catch(error){
        if (error.name === 'MongoServerError' && error.code === 11000) {
            // This error is a duplicate key error
            if (error.keyPattern && error.keyPattern.userName === 1) {
              // This error is specific to the 'userName' field
              console.error('Duplicate userName found:', error.keyValue.userName);
            }
          } else {
            console.error('An error occurred:', error.message);
          }
    }
});





app.post('/signIn', (req, res) => {
    try{
    const password = req.body.password;
    const username = req.body.username;

    USER.findOne({userName:username}).then((foundUser) => {
        if(!foundUser){
            res.send('User not found')
        }else{
            bcrypt.compare(password, foundUser.password, async (err, result) => {
                if(result){
                    res.cookie('user', foundUser)
                    res.redirect('/')
                }else{
                    res.send('password incorrect')
                }
            });
        }

    });

}catch(e){
    console.log(e.message)
}
});






const PORT = process.env.PORT || 5000;
console.log('server started on port:', PORT)
app.listen(PORT)