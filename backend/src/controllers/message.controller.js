import User from "../models/User.js";
import Message from "../models/Message.js";
import Group from "../models/Group.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import redis from "../lib/redis.js";

export const getAllContacts = async (req, res) => {
    try {
        const loggedInUserId = req.user._id; // Retrieves authenticated caller identity.
        const idsToIgnore = [loggedInUserId];
        const filteredUsers = await User.find({ 
        _id: { $nin: idsToIgnore } // Excludes caller from directory results.
    }).select('-password');
        res.status(200).json(filteredUsers);
    } catch (error) {
        console.log("Error in getAllContacts: ", error.message);
        res.status(500).json({ message: "Server Error" });
    }
};

export const getChatPartners = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;

        // Retrieves active participant histories.
        const messages = await Message.find({
            $or: [
                { senderId: loggedInUserId },
                { receiverId: loggedInUserId }
            ]
        });

        // Dedupes conversation partners.
        const partnerIDs = [...new Set(messages.map(msg => {
            // Resolves counterpart identifier robustly.
            return msg.senderId.toString() === loggedInUserId.toString() 
                ? msg.receiverId?.toString() 
                : msg.senderId.toString();
        }))].filter(id => id); // Purges orphaned or group artifacts.

        const chatPartners = await User.find({ _id: { $in: partnerIDs } }).select('-password');

        res.status(200).json(chatPartners);

    } catch (error) {
        console.log(`Error in getChatPartners: ${error.message}`);
        res.status(500).json({ message: "Server Error" });
    }
};

export const getMessagesByUserId = async (req, res) => {
    try {
        const myID = req.user._id;
        const { id: chatPartnerId } = req.params; // Resolves target identifier.

        // Identifies entity type for routing.
        const group = await Group.findById(chatPartnerId);
        
        // --- REDIS LOGIC START ---
        // Determines caching prefix scheme.
        let redisKey;
        if (group) {
            redisKey = `chat:group:${chatPartnerId}`;
        } else {
            // Evaluates lexicographical composite key for bidirectional caching.
            redisKey = `chat:private:${[myID.toString(), chatPartnerId.toString()].sort().join(":")}`;
        }

        // Leverages memory storage bypassing disk reads.
        const cachedMessages = await redis.get(redisKey);
        if (cachedMessages) {
            return res.status(200).json(JSON.parse(cachedMessages));
        }
        // --- REDIS LOGIC END ---

        let messages;
        if (group) {
            // Retrieves collective conversation context.
            messages = await Message.find({ groupId: chatPartnerId });
        } else {
            // Retrieves bidirectional private thread.
            messages = await Message.find({
                $or: [
                    { senderId: myID, receiverId: chatPartnerId },
                    { senderId: chatPartnerId, receiverId: myID }
                ]
            });
        }

        // --- REDIS SAVE START ---
        // Caches payload for ephemeral duration.
        await redis.set(redisKey, JSON.stringify(messages), "EX", 3600);
        // --- REDIS SAVE END ---

        res.status(200).json(messages);
    } catch (error) {
        console.log(`Error in getMessagesByUserId: ${error.message}`);
        res.status(500).json({ message: "Server Error" });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const senderId = req.user._id;
        const { id: chatPartnerId } = req.params; // Captures target entity identifier.
        const { text, image } = req.body;

        if (!text && !image) {
            return res.status(400).json({ message: "Text or image is required." });
        }

        let imageUrl;
        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        // Detects collective entity configuration.
        const group = await Group.findById(chatPartnerId);

        let newMessage;
        let redisKey; // Tracks cache node for invalidation.

        if (group) {
            // --- GROUP MESSAGE LOGIC ---
            redisKey = `chat:group:${chatPartnerId}`; // Assigns collective prefix.

            newMessage = new Message({
                senderId,
                groupId: chatPartnerId,
                text,
                image: imageUrl
            });
            await newMessage.save();

            // Broadcasts payload to individual active peer sockets.
            group.members.forEach(memberId => {
                // Skips transmission to originator.
                if (memberId.toString() === senderId.toString()) return;

                const memberSocketId = getReceiverSocketId(memberId.toString());
                if (memberSocketId) {
                    io.to(memberSocketId).emit('newMessage', newMessage);
                }
            });

        } else {
            // --- PRIVATE MESSAGE LOGIC ---
            // Compares primitives to avoid object reference inequality.
            if (senderId.toString() === chatPartnerId.toString()) {
                return res.status(400).json({ message: "Cannot send messages to yourself." });
            }

            const receiverExists = await User.exists({ _id: chatPartnerId });
            if (!receiverExists) {
                return res.status(404).json({ message: "Receiver not found." });
            }

            // Assigns private prefix.
            redisKey = `chat:private:${[senderId.toString(), chatPartnerId.toString()].sort().join(":")}`;

            newMessage = new Message({
                senderId,
                receiverId: chatPartnerId, // Assigns destination node.
                text,
                image: imageUrl
            });
            await newMessage.save();

            const receiverSocketId = getReceiverSocketId(chatPartnerId);
            if (receiverSocketId) {
                // Embeds sender metadata mitigating client-side fetching overhead.
                const messageWithSender = {
                    ...newMessage.toObject(),
                    senderProfile: {
                        _id: req.user._id,
                        fullName: req.user.fullName,
                        profilePic: req.user.profilePic,
                    }
                };
                io.to(receiverSocketId).emit('newMessage', messageWithSender);
            }
        }

        // --- REDIS INVALIDATION ---
        // Evicts stale entries ensuring consistency.
        if (redisKey) {
            await redis.del(redisKey);
        }

        res.status(201).json(newMessage);
    } catch (error) {
        console.log(`Error in sendMessage: ${error.message}`);
        res.status(500).json({ message: "Server Error" });
    }
};


export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const myId = req.user._id;

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Enforces authorship constraints.
    if (message.senderId.toString() !== myId.toString()) {
      return res.status(403).json({ error: "You can only delete your own messages" });
    }

    // --- REDIS KEY DETECTION ---
    // Identifies target cache namespace for pre-deletion access.
    let redisKey;
    if (message.groupId) {
        redisKey = `chat:group:${message.groupId}`;
    } else if (message.receiverId) {
        redisKey = `chat:private:${[message.senderId.toString(), message.receiverId.toString()].sort().join(":")}`;
    }

    await Message.findByIdAndDelete(id);

    // --- REDIS INVALIDATION ---
    if (redisKey) {
        await redis.del(redisKey);
    }

    // Dispatches teardown notification to recipient sockets.
    if (message.receiverId) {
        const receiverSocketId = getReceiverSocketId(message.receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("messageDeleted", id);
        }
    } else if (message.groupId) {
        // Dispatches teardown notification to active group participant sockets.
        const group = await Group.findById(message.groupId);
        if (group) {
            group.members.forEach(memberId => {
                if (memberId.toString() === myId.toString()) return;
                const memberSocketId = getReceiverSocketId(memberId.toString());
                if (memberSocketId) io.to(memberSocketId).emit("messageDeleted", id);
            });
        }
    }

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    console.log("Error in deleteMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};