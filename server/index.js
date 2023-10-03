//All required NPM packages
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { Server } = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');


//MongoDB/WhatApp connection and Collections
mongoose.connect('mongodb://127.0.0.1:27017/WhatApp');

const CHATS = require('./dbModels/Chats')
const USER = require('./dbModels/User')
const clientNote = require('./dbModels/client.contact')

const app = express()


//Required middleware
app.use(
    bodyParser.json(),
    bodyParser.urlencoded({ extended: false }),
    express.static('client/build'),
    cors(),
    cookieParser(),
);


//Socket.io server for real time chat comunication
const server = http.createServer(app)

const io = new Server(server, {
    transport:['polling'],
    cors:{
        origin:'*'
    }
});


  io.on('connection', (socket) => {
    console.log(`User ${socket.id} has connected!`);

    socket.on('join-room', (data) => {
        console.log(`user ${socket.id} has joined room ${data}`)
        socket.join(data)
    });
  
    socket.on('sendMessage', async (data) => {

        //Locate the correct contact to send the message via MongoDB
      const { from, to, input, room} = data;
      const contactChats = await CHATS.findOne({owner:to})
    const userChats = await CHATS.findOne({owner:from});

    const message = {
        input:input,
        date: new Date(Date.now()).getHours() + ':' + new Date(Date.now()).getMinutes(),
        from:from
    }

    const hasContact = contactChats.chats.some(chat => chat.userName === userChats.owner)

    if(!hasContact){
        const newChat = {
            userName:userChats.owner,
            _id:userChats._id,
            room:room,
            image:userChats.image,
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


      io.to(room).emit('receiveMessage', userChats.chats[userChatIndex].messages);
  })

  socket.on('disconnect', () => {
    console.log(`user ${socket.id} has disconnected`)
  })
});


function locateContact(chats, chatToFind){

    for(let i = 0; i<chats.length; i++){
        if(chats[i].userName == chatToFind){
            return i
        }
    }
};


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
        res.send(chat)
        }else{
        res.send(null)
        }
    }catch(err){
        console.log(err.message)
    }
});

app.post('/api/searchUsers', async (req, res) => {

    const result = await CHATS.find(
        {
            $and:[
                {
            owner:{
                $regex: req.body.userName,
                $options: 'i'
            }
        },
        {
            owner: {
                $ne: req.body.personalUser.userName
              }
        }
    ]
})
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
    const newChats = await CHATS.findOne({owner: req.body.chatUserName});
    const userChats = await CHATS.findOne({owner:req.cookies.user.userName}) 
    console.log(req.body.chatUserName)
    console.log(newChats)

    function roomID(){
        const hasContact = newChats.chats.some(chat => chat.userName === userChats.owner)
        if(!hasContact){
            return (`${newChats.owner + userChats.owner}`)
        }else{
            const index = locateContact(newChats.chats, userChats.owner)
            return newChats.chats[index].room
        }
    };

    const chat = {
                userName:newChats.owner,
                image:newChats.image,
                _id:newChats._id,
                room:roomID(),
            messages:[]
        };

   await userChats.chats.push(chat)
   await userChats.save()
        res.redirect('/')
});


//Main client display route
app.get('*', async (req, res) => {
    try{
        res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
    }catch(err){
        console.log(err.message)
    }
});


/*
DISCONNECTED USER API BELOW
*/

app.post('/contact', async (req, res) => {
    const noteInfo = await new clientNote({
        name:req.body.fullName,
        email:req.body.email,
        message:req.body.message
    });

    await noteInfo.save();

    res.redirect('/');
});

//No user side registeration and request handling
app.post('/signUp', async (req, res) => {
    // New user entering + password encryption
    console.log(req.body);

    const {
        userName,
        email,
        country,
        city,
        street,
        zipCode,
        password,
        confirm,
    } = req.body;

    try {
        if (password !== confirm) {
            res.status(400).send('Passwords do not match');
            return;
        }

        if (!/^\d+$/.test(zipCode) || zipCode.length<6) {
            res.status(400).send('Zip code must be a six digit number');
            return;
        }

        const existingUser = await USER.findOne({ userName });

        console.log(existingUser)

        if (existingUser) {
            res.status(400).send('Username already in use');
            return;
        }

        bcrypt.hash(password, 10, async (err, hash) => {
            if (err) {
                console.log(err);
                res.status(500).send('An error occurred');
                return;
            }

            const newUser = await new USER({
                userName,
                password: hash,
                email,
                adress: {
                    country,
                    city,
                    street,
                    zip_code: zipCode,
                },
            });

            const newChat = await new CHATS({
                owner: userName,
                chats: [],
            });

            newChat.save();
            newUser.save();
            res.cookie('user', newUser);
            res.redirect('/uploadImage')
        });
    } catch (error) {
        console.error('An error occurred:', error.message);
        res.status(500).send('An error occurred');
    }
});


//API route to sign into an existing user
app.post('/signIn', async (req, res) => {
    try {
        const password = req.body.password;
        const username = req.body.username;

        if (!username || !password) {
            res.status(400).send('Username and password are required.');
            return;
        }

        const foundUser = await USER.findOne({ userName: username });

        if (!foundUser) {
            res.status(404).send('User not found');
            return;
        }

        bcrypt.compare(password, foundUser.password, async (err, result) => {
            if (result) {
                res.cookie('user', foundUser);
                res.sendStatus(200); // Sign-in successful
            } else {
                res.status(401).send('Password incorrect');
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('An error occurred');
    }
});

app.post('/uploadImage', async (req, res) => {
    const user = req.cookies.user.userName
    const newImage = req.body.myFile

    try{
        const userChat = await CHATS.findOne({owner:user});
        //Sets a new image to the users chat document

        userChat.image = newImage
        await userChat.save()

        res.status(201).json( { msg: 'New image uploaded' } )
    }catch(error){

        res.status(409).json( { message : error.message } )

    }
});



//PORTS
server.listen(4000, () => {
    console.log('listening to socket port')
});

const PORT = process.env.PORT || 5000;
console.log('server started on port:', PORT)
app.listen(PORT);