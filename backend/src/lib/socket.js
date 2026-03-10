import {Server} from "socket.io";
import http from 'http';
import express from 'express';
import {ENV} from './env.js';
import {socketAuthMiddleware} from '../middleware/socketAuthMiddleware.js';

const app = express();
const server = http.createServer(app)

const io = new Server(server,{
    cors : {
        origin : [ENV.CLIENT_URL, "https://flash-chat-io.netlify.app"],
        credentials : true,
    },

});

io.use(socketAuthMiddleware);

const userSocketMap = {};

export function getReceiverSocketId(userId){
    return userSocketMap[userId];
}

io.on('connection',(socket) => {
    console.log(`A user is connected ${socket.user.fullName}`)

    const userId = socket.userId;
    userSocketMap[userId] = socket.id;

    io.emit('getOnlineUsers',Object.keys(userSocketMap));

    // WebRTC signaling pipeline.
    
    // Routes initial SDP offer.
    socket.on("call-user", ({ userToCall, signalData, from, name }) => {
        const targetSocketId = getReceiverSocketId(userToCall);
        
        if (targetSocketId) {
            // Dispatches payload to recipient.
            io.to(targetSocketId).emit("call-user", { signal: signalData, from, name });
        }
    });

    // Routes subsequent SDP answer.
    socket.on("answer-call", (data) => {
        const targetSocketId = getReceiverSocketId(data.to);
        
        if (targetSocketId) {
            // Completes handshake loop.
            io.to(targetSocketId).emit("call-accepted", data.signal);
        }
    });

    // STUN/TURN routing resolution.
    socket.on("send-ice-candidate", ({ to, candidate }) => {
        const targetSocketId = getReceiverSocketId(to);
        
        if (targetSocketId) {
            // Exchanges finalized traversal paths.
            io.to(targetSocketId).emit("receive-ice-candidate", candidate);
        }
    });

    // Manages peer teardown.
    socket.on("end-call", ({ to }) => {
        const targetSocketId = getReceiverSocketId(to);
        if (targetSocketId) {
            io.to(targetSocketId).emit("call-ended");
        }
    });

    // ---


    socket.on('disconnect',()=>{
        console.log(`User disconnected ${socket.user.fullName}`);
        delete userSocketMap[userId];
        io.emit('getOnlineUsers',Object.keys(userSocketMap));
    })

    
});


export {io,server,app}