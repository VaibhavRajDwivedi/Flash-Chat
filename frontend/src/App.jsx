import React, { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import ChatPage from './pages/ChatPage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import { useAuthStore } from './store/useAuthStore'
import { useChatStore } from './store/useChatStore'
import PageLoader from './components/PageLoader'
import { Toaster } from 'react-hot-toast'

function App() {
  const { checkAuth, isCheckingAuth, authUser } = useAuthStore();
  const { subscribeToMessages, unsubscribeFromMessages } = useChatStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (authUser) {
      subscribeToMessages();
    }
    return () => {
      unsubscribeFromMessages();
    }
  }, [authUser, subscribeToMessages, unsubscribeFromMessages]);

  console.log({ authUser });

  if (isCheckingAuth) return <PageLoader />;

  return (
    <div data-theme="business">



      <Routes>
        <Route path='/' element={authUser ? <ChatPage /> : <Navigate to={"/login"} />} />
        <Route path='/login' element={!authUser ? <LoginPage /> : <Navigate to={'/'} />} />
        <Route path='/signup' element={!authUser ? <SignUpPage /> : <Navigate to={'/'} />} />
      </Routes>

      <Toaster />
    </div>
  )
}

export default App  