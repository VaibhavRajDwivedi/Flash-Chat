import Group from "../models/Group.js";
import Message from "../models/Message.js";
import { io, getReceiverSocketId } from "./socket.js";

const sendSystemMessage = async (groupId, text, senderId) => {
    try {
        const systemMsg = new Message({
            groupId,
            senderId, // Required by schema
            text,
            isSystemMessage: true,
        });

        await systemMsg.save();

        // Need the group to get member IDs for broadcasting
        const group = await Group.findById(groupId);
        if (!group) return;

        group.members.forEach((memberId) => {
            const socketId = getReceiverSocketId(memberId.toString());
            if (socketId) io.to(socketId).emit("newMessage", systemMsg);
        });

    } catch (error) {
        console.error("Error sending system message:", error);
    }
};

export default sendSystemMessage;
