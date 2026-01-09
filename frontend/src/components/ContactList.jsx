import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore"
import UsersLoadingSkeleton from "./UsersLoadingSkeleton"
import { useAuthStore } from "../store/useAuthStore"
function ContactList() {
  const { getAllContacts, allContacts, setSelectedUser, isUserLoading, selectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();
  useEffect(() => {
    getAllContacts();
  }, [getAllContacts])

  if (isUserLoading) return <UsersLoadingSkeleton />


  return (
    <>
      {allContacts.map((contact) => (
        <div
          key={contact._id}
          onClick={() => setSelectedUser(contact)}
          className={`
            w-full p-3 flex items-center gap-3  rounded-lg transition-colors cursor-pointer justify-start
            ${selectedUser?._id === contact._id ? "bg-base-300 ring-1 ring-base-300" : "hover:bg-base-300"}
          `}
        >
          <div className="relative">
            <img
              src={contact.profilePic || "/avatar.png"}
              alt={contact.fullName}
              className="size-12 object-cover rounded-full"
            />
            {onlineUsers.includes(contact._id) && (
              <span
                className="absolute bottom-0 right-0 size-3 bg-green-500 
                  rounded-full ring-2 ring-zinc-900"
              />
            )}
          </div>

          <div className="text-left min-w-0">
            <div className="font-medium truncate">{contact.fullName}</div>
            <div className="text-sm text-zinc-400">
              {onlineUsers.includes(contact._id) ? "Online" : "Offline"}
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

export default ContactList