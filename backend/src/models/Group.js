import mongoose from "mongoose";
const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true, // Clarifies purpose during UI rendering.
    },
    admin: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Tracks participation limits and permissions.
      },
    ],
    groupImage: {
      type: String, // Enhances distinctiveness in list views.
      default: "",
    },
  },
  { timestamps: true }
);

const Group = mongoose.model("Group", groupSchema);

export default Group;