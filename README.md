# Flash Chat ⚡

A modern, full-stack real-time messaging application built with the **MERN** stack. Flash Chat offers a premium user experience with features like one-on-one messaging, group chats, and real-time video calls.



## ✨ Features

- **Real-time Messaging**: Instant message delivery using [Socket.io](https://socket.io/).
- **🎥 Video Calls**: High-quality video and audio calls with WebRTC and peer-to-peer connections.
- **👥 Group Chats**: Create and manage groups, add/remove members, and assign admin roles.
- **🔒 Secure Authentication**: JWT-based auth with secure cookie storage.
- **🖼️ Media Sharing**: Send images effortlessly (powered by Cloudinary).
- **🟢 Online Status**: See who is online in real-time.
- **🎨 Modern UI**: Beautiful, dark-themed interface built with **TailwindCSS** and **DaisyUI**.
- **📱 Responsive**: Fully optimized for desktop and mobile devices.

## 🛠️ Tech Stack

### Frontend
- **Framework**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Styling**: [TailwindCSS](https://tailwindcss.com/) + [DaisyUI](https://daisyui.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Routing**: [React Router](https://reactrouter.com/)
- **Real-time**: Socket.io-client

### Backend
- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) (Mongoose)
- **Socket**: Socket.io (Signaling & Messaging)
- **Security**: [Arcjet](https://arcjet.com/) (Bot detection/Protection)
- **Image Storage**: [Cloudinary](https://cloudinary.com/)
- **Emails**: [Resend](https://resend.com/)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB (Local or Atlas)
- Cloudinary Account
- Resend API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/flash-chat.git
   cd flash-chat
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   ```
   Create a `.env` file in `backend/`:
   ```env
   PORT=5001
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   NODE_ENV=development
   
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

   RESEND_API_KEY=your_resend_key
   
   # Arcjet Security (Optional)
   ARCJET_KEY=your_arcjet_key
   ```
   Start the server:
   ```bash
   npm run dev
   ```

3. **Setup Frontend**
   ```bash
   cd ../frontend
   npm install
   ```
   Create a `.env` file in `frontend/`:
   ```env
   # Backend URL (adjust port if needed)
   VITE_API_URL=http://localhost:5001/api 
   ```
   Start the client:
   ```bash
   npm run dev
   ```

## 📸 Screenshots

| Login Page | Chat Interface |
|:---:|:---:|
| Add login screenshot here | Add chat screenshot here |

| Video Call | Group Settings |
|:---:|:---:|
| Add video call screenshot | Add group info screenshot |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the content of the [MIT License](LICENSE).
