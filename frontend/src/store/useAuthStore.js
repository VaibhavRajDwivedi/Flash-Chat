import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const BASE_URL = import.meta.env.MODE === 'development'
    ? 'http://localhost:3000'
    : 'https://flash-chat-7y8k.onrender.com'

export const useAuthStore = create((set,get) => ({
  authUser: null,
  isCheckingAuth: false,
  isSigningUp: false,
  isLoggingIn: false,
  isLoggingOut: false,
  socket:null,
  onlineUsers : [],
  checkAuth: async () => {
    try {
      set({ isCheckingAuth: true });
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log(`Error in Auth Check : ${error}`);
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (formData) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", formData);
      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "Signup failed");
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Successfully Loggedin");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
    } finally {
      set({ isLoggingIn: false });
    }
  },


  logout: async () => {
    set({ isLoggingOut: true });
    try {
      await axiosInstance.post("/auth/logout");
      toast.success("Logged Out Successfully");
      set({ authUser: null });
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "Logout failed");
    } finally {
      set({ isLoggingOut: false });
    }
  },

  updateProfile: async (data) => {
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log(`Error in Update Profile : ${error}`);
      toast.error(error.response?.data?.message || "Profile update failed");
    }
  },

  connectSocket : () => {
    const {authUser} = get();
    if(!authUser || get().socket?.connected) return

    const socket = io(BASE_URL,{withCredentials:true})

    socket.connect();

    set({socket:socket})

    socket.on("getOnlineUsers",(userIds) => {
      set({onlineUsers : userIds})
    })
  },

  disconnectSocket : () =>{
    if(get().socket?.connected) get().socket.disconnect();
  }

}));
