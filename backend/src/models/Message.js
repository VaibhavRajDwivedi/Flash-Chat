import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    senderId:{
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    }
    ,
    receiverId:{
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : false,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
    text:{
        type : String,  
        
        trim : true,
        maxlenghth : 2000,
    },
    image:{
        type : String,
    },
    isSystemMessage: { type: Boolean, default: false },
},{timestamps:true});


const Message = mongoose.model("Message",messageSchema);

export default Message;