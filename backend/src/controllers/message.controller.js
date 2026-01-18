import User from "../models/User.js";
import Message from "../models/Message.js";
import Group from "../models/Group.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import redis from "../lib/redis.js";

export const getAllContacts = async (req, res) => {
    try {
        const loggedInUserId = req.user._id; // <--- Safe approach
        const idsToIgnore = [loggedInUserId];
        const filteredUsers = await User.find({ 
        _id: { $nin: idsToIgnore } // Find users whose _id is NOT IN this array
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

        // Find all messages where I am the sender OR receiver
        const messages = await Message.find({
            $or: [
                { senderId: loggedInUserId },
                { receiverId: loggedInUserId }
            ]
        });

        // Extract unique IDs of people I've talked to
        const partnerIDs = [...new Set(messages.map(msg => {
            // Check if sender is me, if so, return receiver. Otherwise return sender.
            // toString() is crucial here to ensure strict comparison works
            return msg.senderId.toString() === loggedInUserId.toString() 
                ? msg.receiverId?.toString() 
                : msg.senderId.toString();
        }))].filter(id => id); // Filter out undefined/null (clean up group messages if any slipped in)

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
        const { id: chatPartnerId } = req.params; // Can be UserID or GroupID

        // Check if the ID belongs to a Group
        const group = await Group.findById(chatPartnerId);
        
        // --- REDIS LOGIC START ---
        // Determine the cache key based on Group vs Private
        let redisKey;
        if (group) {
            redisKey = `chat:group:${chatPartnerId}`;
        } else {
            // Sort IDs to ensure consistent key for private chats
            redisKey = `chat:private:${[myID.toString(), chatPartnerId.toString()].sort().join(":")}`;
        }

        // Check Redis Cache first
        const cachedMessages = await redis.get(redisKey);
        if (cachedMessages) {
            return res.status(200).json(JSON.parse(cachedMessages));
        }
        // --- REDIS LOGIC END ---

        let messages;
        if (group) {
            // It is a GROUP! Fetch all messages for this group
            messages = await Message.find({ groupId: chatPartnerId });
        } else {
            // It is a USER! Fetch 1-on-1 private messages
            messages = await Message.find({
                $or: [
                    { senderId: myID, receiverId: chatPartnerId },
                    { senderId: chatPartnerId, receiverId: myID }
                ]
            });
        }

        // --- REDIS SAVE START ---
        // Save result to Redis for 1 hour (3600 seconds)
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
        const { id: chatPartnerId } = req.params; // Can be UserID or GroupID
        const { text, image } = req.body;

        if (!text && !image) {
            return res.status(400).json({ message: "Text or image is required." });
        }

        let imageUrl;
        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        // Check if we are sending to a GROUP
        const group = await Group.findById(chatPartnerId);

        let newMessage;
        let redisKey; // To store the key we need to invalidate

        if (group) {
            // --- GROUP MESSAGE LOGIC ---
            redisKey = `chat:group:${chatPartnerId}`; // Identify key

            newMessage = new Message({
                senderId,
                groupId: chatPartnerId,
                text,
                image: imageUrl
            });
            await newMessage.save();

            // Loop through all members and send to their specific socket ID
            group.members.forEach(memberId => {
                // (Optional) Don't send back to the sender, they add it manually
                if (memberId.toString() === senderId.toString()) return;

                const memberSocketId = getReceiverSocketId(memberId.toString());
                if (memberSocketId) {
                    io.to(memberSocketId).emit('newMessage', newMessage);
                }
            });

        } else {
            // --- PRIVATE MESSAGE LOGIC ---
            // Convert to string for comparison safety
            if (senderId.toString() === chatPartnerId.toString()) {
                return res.status(400).json({ message: "Cannot send messages to yourself." });
            }

            const receiverExists = await User.exists({ _id: chatPartnerId });
            if (!receiverExists) {
                return res.status(404).json({ message: "Receiver not found." });
            }

            // Identify key
            redisKey = `chat:private:${[senderId.toString(), chatPartnerId.toString()].sort().join(":")}`;

            newMessage = new Message({
                senderId,
                receiverId: chatPartnerId, // Use receiverId
                text,
                image: imageUrl
            });
            await newMessage.save();

            const receiverSocketId = getReceiverSocketId(chatPartnerId);
            if (receiverSocketId) {
                // Attach sender info so the receiver can update their chat list immediately - For immediade Chat List updation
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
        // Since we added a message, the cached conversation is outdated. Delete it.
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

    // Ensure only the sender can delete their message
    if (message.senderId.toString() !== myId.toString()) {
      return res.status(403).json({ error: "You can only delete your own messages" });
    }

    // --- REDIS KEY DETECTION ---
    // We need to know which cache to clear *before* we delete the message
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

    // REAL-TIME UPDATE: Notify the receiver
    // (Existing logic + Group support)
    if (message.receiverId) {
        const receiverSocketId = getReceiverSocketId(message.receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("messageDeleted", id);
        }
    } else if (message.groupId) {
        // Optional: Notify group members if you want real-time deletes in groups
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