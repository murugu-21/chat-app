import './App.css'
import { BrowserRouter, Route, Routes } from 'react-router';
import LoginPage from './pages/Login';
import Home from './pages/Home';
import Chat from './pages/Chat';

function App() {
  return (
      <BrowserRouter>
        <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path='/' element={<Home />} />
        <Route path='/chat/:chatId' element={<Chat />} />
        </Routes>
      </BrowserRouter>
  );
}

export default App
