import Group from "../models/Group.js";
import { io, getReceiverSocketId } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

import sendSystemMessage from "../lib/sendSystemMessage.js";

export const createGroup = async (req, res) => {
  try {
    const { name, members } = req.body;
    const creatorId = req.user._id; // Assigns creator as initial administrator.

    // Validates payload integrity.
    if (!name) {
      return res.status(400).json({ message: "Group name is required" });
    }
    if (!members || members.length < 2) {
      return res.status(400).json({ message: "A group must have at least 2 other members" });
    }

    // Ensures creator inclusion without duplication.
    const allMembers = [...new Set([...members, creatorId])];

    // Persists new group entity.
    const newGroup = new Group({
      name,
      admin : [creatorId],
      members: allMembers,
    });

    await newGroup.save();

    // Eagerly loads member details for immediate rendering.
    await newGroup.populate("members", "-password");
    await newGroup.populate("admin", "-password");

    newGroup.members.forEach((memberId) => {
        if (memberId.toString() === creatorId.toString()) return; // Prevents echo to initiator.

        const socketId = getReceiverSocketId(memberId.toString());
        
        if (socketId) {
            io.to(socketId).emit("newGroup", newGroup); // Dispatches creation payload to peers.
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

    // Retrieves joined groups via inclusion check.
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

        // Enforces administrative authorization.
        const isRequesterAdmin = group.admin.includes(requesterId);
        if (!isRequesterAdmin) {
            return res.status(403).json({ message: "Only admins can change roles" });
        }

        // Evaluates promotion versus demotion.
        const isTargetAlreadyAdmin = group.admin.includes(userId);

        if (isTargetAlreadyAdmin) {
            // Prevents administrative lockout during demotion.
            if (group.admin.length === 1) return res.status(400).json({ message: "Group must have at least one admin" });
            
            group.admin = group.admin.filter(id => id.toString() !== userId.toString());
        } else {
            // Promotes member to administrator.
            group.admin.push(userId);
        }

        await group.save();
        
        // Refreshes entity representation post-mutation.
        await group.populate("members", "-password");
        await group.populate("admin", "-password");

        // Propagates role changes to participants.
        group.members.forEach((member) => {
            const socketId = getReceiverSocketId(member._id.toString());
            if (socketId) {
                io.to(socketId).emit("groupUpdated", group); // Triggers client-side state update.
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

    // Validates requester administrative privileges.
    const isRequesterAdmin = group.admin.some(id => id.toString() === requesterId.toString());
    if (!isRequesterAdmin) return res.status(403).json({ message: "Unauthorized" });

    // Purges member from all group collections.
    group.members = group.members.filter(id => id.toString() !== userId);
    group.admin = group.admin.filter(id => id.toString() !== userId);

    await group.save();
    await group.populate("members admin", "-password");

    // Alerts active participants of roster change.
    group.members.forEach(member => {
      const socketId = getReceiverSocketId(member._id.toString());
      if (socketId) io.to(socketId).emit("groupUpdated", group);
    });

    // Triggers client-side cleanup for removed user.
    const kickedSocketId = getReceiverSocketId(userId);
    if (kickedSocketId) {
      io.to(kickedSocketId).emit("groupUpdated", { _id: groupId, wasRemoved: true, name: group.name });
    }

    // Dispatches automated removal notification.
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



    // Handles voluntary participant exit.
export const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.body;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const isAdmin = group.admin.some((id) => id.toString() === userId.toString());

    // Prevents orphaned groups via early exit.
    if (isAdmin && group.admin.length === 1 && group.members.length > 1) {
      return res.status(400).json({ 
        message: "You are the only admin. Assign someone else as admin before leaving." 
      });
    }

    // Dispatches automated departure notification.
    await sendSystemMessage(groupId, `${req.user.fullName} has left the group`, userId);

    // Purges exiting member from collections.
    group.members = group.members.filter((id) => id.toString() !== userId.toString());
    group.admin = group.admin.filter((id) => id.toString() !== userId.toString());

    // Garbage collects empty groups.
    if (group.members.length === 0) {
      await Group.findByIdAndDelete(groupId);
      return res.status(200).json({ message: "Group deleted as no members left" });
    }

    await group.save();
    await group.populate("members admin", "-password");

    // Alerts active participants of roster change.
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
    const { groupId, newMembers } = req.body; // Expects array of candidate identifiers.
    const requesterId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // Enforces administrative authorization.
    const isRequesterAdmin = group.admin.some(id => id.toString() === requesterId.toString());
    if (!isRequesterAdmin) return res.status(403).json({ message: "Only admins can add members" });

    // Prevents duplicate memberships.
    const usersToAdd = newMembers.filter(id => !group.members.includes(id));

    if (usersToAdd.length === 0) {
      return res.status(400).json({ message: "Users are already members of this group" });
    }

    // Appends validated candidates.
    group.members.push(...usersToAdd);
    await group.save();
    
    await group.populate("members admin", "-password");

    // Propagates roster changes to all peers.
    group.members.forEach((member) => {
      const socketId = getReceiverSocketId(member._id.toString());
      if (socketId) io.to(socketId).emit("groupUpdated", group);
    });

    // Resolves candidate names for notification dispatch.
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