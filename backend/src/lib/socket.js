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

    // ============================================
    // VIDEO CALL SIGNALING (The "Digital Courier")
    // ============================================

    // When User A wants to call User B, they send the "signal" (SDP) here.
    socket.on("call-user", ({ userToCall, signalData, from, name }) => {
        const targetSocketId = getReceiverSocketId(userToCall);
        
        if (targetSocketId) {
            // Forward the Offer to User B, including the name
            io.to(targetSocketId).emit("call-user", { signal: signalData, from, name });
        }
    });

    // When User B accepts, they send their "signal" (Answer SDP) back.
    socket.on("answer-call", (data) => {
        const targetSocketId = getReceiverSocketId(data.to);
        
        if (targetSocketId) {
            // Forward the Answer back to User A (the caller)
            io.to(targetSocketId).emit("call-accepted", data.signal);
        }
    });

    // Handling ICE CANDIDATES (The "Connectivity Path")
    // These are the network routes found by the browser.
    socket.on("send-ice-candidate", ({ to, candidate }) => {
        const targetSocketId = getReceiverSocketId(to);
        
        if (targetSocketId) {
            // Forward the candidate to the other peer so they can connect
            io.to(targetSocketId).emit("receive-ice-candidate", candidate);
        }
    });

    // Handle Call Disconnection
    socket.on("end-call", ({ to }) => {
        const targetSocketId = getReceiverSocketId(to);
        if (targetSocketId) {
            io.to(targetSocketId).emit("call-ended");
        }
    });

    // ============================================


    socket.on('disconnect',()=>{
        console.log(`User disconnected ${socket.user.fullName}`);
        delete userSocketMap[userId];
        io.emit('getOnlineUsers',Object.keys(userSocketMap));
    })

    
});


export {io,server,app}