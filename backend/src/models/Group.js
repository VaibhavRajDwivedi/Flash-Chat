import mongoose from "mongoose";
const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true, // Every group needs a name (e.g., "Family", "Project Team")
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
        ref: "User", // Array of User IDs who are in this group
      },
    ],
    groupImage: {
      type: String, // Optional: URL to a group icon
      default: "",
    },
  },
  { timestamps: true }
);

const Group = mongoose.model("Group", groupSchema);

export default Group;