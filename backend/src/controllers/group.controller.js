import Group from "../models/Group.js";
import { io, getReceiverSocketId } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

import sendSystemMessage from "../lib/sendSystemMessage.js";

export const createGroup = async (req, res) => {
  try {
    const { name, members } = req.body;
    const creatorId = req.user._id; // The user creating the group is the admin

    // 1. Basic Validation
    if (!name) {
      return res.status(400).json({ message: "Group name is required" });
    }
    if (!members || members.length < 2) {
      return res.status(400).json({ message: "A group must have at least 2 other members" });
    }

    // 2. Add the Admin to the members list (so they are part of the chat too!)
    // We use Set to prevent duplicate IDs just in case
    const allMembers = [...new Set([...members, creatorId])];

    // 3. Create the Group in Database
    const newGroup = new Group({
      name,
      admin : [creatorId],
      members: allMembers,
    });

    await newGroup.save();

    // Populate the members so frontend gets full user details immediately
    await newGroup.populate("members", "-password");
    await newGroup.populate("admin", "-password");

    newGroup.members.forEach((memberId) => {
        if (memberId.toString() === creatorId.toString()) return; // Skip sender

        const socketId = getReceiverSocketId(memberId.toString());
        
        if (socketId) {
            io.to(socketId).emit("newGroup", newGroup); // <--- Emit event
        }
    });

    res.status(201).json(newGroup);
  } catch (error) {
    console.log("Error in createGroup controller: ", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getMyGroups = async (req, res) => {
  try {
    const myId = req.user._id;

    // Find all groups where the "members" array contains my ID
    const groups = await Group.find({ members: myId }).populate("members", "-password").populate("admin", "-password");

    res.status(200).json(groups);
  } catch (error) {
    console.log("Error in getMyGroups: ", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const toggleGroupAdmin = async (req, res) => {
    try {
        const { groupId, userId } = req.body;
        const requesterId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ message: "Group not found" });

        // Security: Only an existing admin can change admins
        const isRequesterAdmin = group.admin.includes(requesterId);
        if (!isRequesterAdmin) {
            return res.status(403).json({ message: "Only admins can change roles" });
        }

        // Toggle Logic
        const isTargetAlreadyAdmin = group.admin.includes(userId);

        if (isTargetAlreadyAdmin) {
            // Remove from admin (Filter out the ID)
            // Prevent removing the LAST admin (optional safety)
            if (group.admin.length === 1) return res.status(400).json({ message: "Group must have at least one admin" });
            
            group.admin = group.admin.filter(id => id.toString() !== userId.toString());
        } else {
            // Add to admin
            group.admin.push(userId);
        }

        await group.save();
        
        // Re-populate to send full updated object back
        await group.populate("members", "-password");
        await group.populate("admin", "-password");

        // Broadcast update to everyone in group
        group.members.forEach((member) => {
            const socketId = getReceiverSocketId(member._id.toString());
            if (socketId) {
                io.to(socketId).emit("groupUpdated", group); // <--- Listen for this in Frontend!
            }
        });

        res.status(200).json(group);

    } catch (error) {
        console.log("Error in toggleGroupAdmin: ", error.message);
        res.status(500).json({ message: "Server Error" });
    }
};


export const removeMember = async (req, res) => {
  try {
    const { groupId, userId } = req.body;
    const requesterId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // Check if the person asking is actually an admin
    const isRequesterAdmin = group.admin.some(id => id.toString() === requesterId.toString());
    if (!isRequesterAdmin) return res.status(403).json({ message: "Unauthorized" });

    // Remove user from both arrays
    group.members = group.members.filter(id => id.toString() !== userId);
    group.admin = group.admin.filter(id => id.toString() !== userId);

    await group.save();
    await group.populate("members admin", "-password");

    // Notify remaining members
    group.members.forEach(member => {
      const socketId = getReceiverSocketId(member._id.toString());
      if (socketId) io.to(socketId).emit("groupUpdated", group);
    });

    // Notify the kicked user so their UI clears
    const kickedSocketId = getReceiverSocketId(userId);
    if (kickedSocketId) {
      io.to(kickedSocketId).emit("groupUpdated", { _id: groupId, wasRemoved: true, name: group.name });
    }

    // System Message for Member Removal
    const kickedUser = await User.findById(userId);
    if (kickedUser) {
        await sendSystemMessage(
            groupId,
            `${req.user.fullName} removed ${kickedUser.fullName} from the group`,
            requesterId
        );
    }

    res.status(200).json(group);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};



// Leave Group Logic
export const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.body;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const isAdmin = group.admin.some((id) => id.toString() === userId.toString());

    // SAFETY CHECK: If last admin tries to leave
    if (isAdmin && group.admin.length === 1 && group.members.length > 1) {
      return res.status(400).json({ 
        message: "You are the only admin. Assign someone else as admin before leaving." 
      });
    }

    // Create a System Message
    await sendSystemMessage(groupId, `${req.user.fullName} has left the group`, userId);

    // Remove user from members and admin arrays
    group.members = group.members.filter((id) => id.toString() !== userId.toString());
    group.admin = group.admin.filter((id) => id.toString() !== userId.toString());

    // If no members left, delete the group entirely
    if (group.members.length === 0) {
      await Group.findByIdAndDelete(groupId);
      return res.status(200).json({ message: "Group deleted as no members left" });
    }

    await group.save();
    await group.populate("members admin", "-password");

    // Broadcast to remaining members
    group.members.forEach((member) => {
      const socketId = getReceiverSocketId(member._id.toString());
      if (socketId) io.to(socketId).emit("groupUpdated", group);
    });

    res.status(200).json({ message: "Left group successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};


export const addMembers = async (req, res) => {
  try {
    const { groupId, newMembers } = req.body; // newMembers is an array of IDs
    const requesterId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // 1. Only admins can add new people
    const isRequesterAdmin = group.admin.some(id => id.toString() === requesterId.toString());
    if (!isRequesterAdmin) return res.status(403).json({ message: "Only admins can add members" });

    // 2. Filter out users who are already in the group
    const usersToAdd = newMembers.filter(id => !group.members.includes(id));

    if (usersToAdd.length === 0) {
      return res.status(400).json({ message: "Users are already members of this group" });
    }

    // 3. Update the group
    group.members.push(...usersToAdd);
    await group.save();
    
    await group.populate("members admin", "-password");

    // 4. Notify everyone in the group (including new ones)
    group.members.forEach((member) => {
      const socketId = getReceiverSocketId(member._id.toString());
      if (socketId) io.to(socketId).emit("groupUpdated", group);
    });

    // 5. System Message for Added Members
    // Fetch names of added users
    const addedUsers = await User.find({ _id: { $in: usersToAdd } });
    const addedNames = addedUsers.map(u => u.fullName).join(", ");
    
    await sendSystemMessage(
        groupId, 
        `${req.user.fullName} added ${addedNames}`, 
        requesterId
    );

    res.status(200).json(group);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};