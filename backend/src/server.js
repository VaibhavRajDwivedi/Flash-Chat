import cookieParser from 'cookie-parser';
import express from 'express'; 
import dotenv from 'dotenv';
import authRoute from './routes/auth.route.js';
import messageRoute from './routes/message.route.js';
import { connectDB } from './lib/db.js';
import cors from 'cors';
import { app,server } from './lib/socket.js';
import groupRoutes from './routes/group.route.js';

dotenv.config();

const PORT = process.env.PORT || 3000;



app.use(express.json({limit : '10mb'}));
app.use(cors({origin: [process.env.CLIENT_URL, process.env.CLIENT_URL_PROD], credentials: true}));
app.use(cookieParser());

app.use('/api/auth', authRoute)
app.use('/api/messages', messageRoute)
app.use("/api/groups", groupRoutes);

server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`)

    connectDB()
})