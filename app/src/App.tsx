import './App.css'
import { BrowserRouter, Route, Routes } from 'react-router';

function App() {
  return (
      <BrowserRouter>
        <Routes>
        <Route path="/login" element={<div></div>}/>
        </Routes>
      </BrowserRouter>
  );
}

export default App
