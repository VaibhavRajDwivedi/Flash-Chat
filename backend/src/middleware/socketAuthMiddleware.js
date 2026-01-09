import jwt from 'jsonwebtoken';
import {ENV} from '../lib/env.js';
import User from '../models/User.js';

export const socketAuthMiddleware = async (socket,next) => {
    try{
        const token = socket.handshake.headers.cookie
        ?.split("; ")
        .find((row) => row.startsWith("jwt="))
        ?.split("=")[1];
        
        if(!token){
            console.log("Socket Auth Middleware: Token missing");
            return next(new Error("Unauthorized access, token missing"));
        }

        const decoded = jwt.verify(token,ENV.JWT_SECRET);

        const user  = await User.findById(decoded.userId).select('-password');

        if(!user){
            console.log("Socket Auth Middleware: User not found");
            return next(new Error("Unauthorized access, user not found"));
        }

        socket.user = user;
        socket.userId = user._id.toString();
        next();
    }catch(error){
        console.log(`Error in Socket Auth Middleware : ${error}`);
        res.status(500).json({message : "Internal Server error"});
    }
}