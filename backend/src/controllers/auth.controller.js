import { generateToken } from '../lib/utils.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import { sendWelcomeEmail } from '../emails/emailHandlers.js';
import dotenv from 'dotenv';
import cloudinary from '../lib/cloudinary.js';
dotenv.config();

export const signup = async  (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const emailregex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if(!emailregex.test(email)){
            return res.status(400).json({message: "Invalid email address"});
    }

    const userExists = await User.findOne({ email: email });

    if (userExists) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullName: fullName,
      email: email,
      password: hashedPassword,
    });

    if (newUser) {
      const savedUser = await newUser.save();
      generateToken(savedUser._id, res);
      try {
        await sendWelcomeEmail(email, fullName, process.env.CLIENT_URL);
      } catch (error) {
        console.error("Failed to send welcome email:", error);
      }

      return res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePic: newUser.profilePic,
      });
    } else {
      return res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.log(`Error in signup controller: ${error}`);
    return res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    generateToken(user._id, res);

    return res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
    });
  } catch (error) {
    console.log(`Error in login controller: ${error}`);
    return res.status(500).json({ message: "Server error" });
  }
};

export const logout = async (req, res) => {
  res.cookie("jwt", "", { maxAge: 0 });
  return res.status(200).json({ message: "Logged out successfully" });
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    if (!profilePic) {
      return res.status(400).json({ message: "Profile picture is required" });
    }

    const userId = req.user._id;

    const uploadedResponse = await cloudinary.uploader.upload(profilePic);

        const updatedUser = await User.findByIdAndUpdate(userId,{profilePic:uploadedResponse.secure_url},{new:true}).select('-password');

    res.status(200).json(updatedUser);
  } catch (error) {
    console.log(`Error in Update Profile : ${error}`);
    res.status(500).json({ message: "Internal Server error" });
  }
};
