import { useState } from 'react'
import Header from './components/Header/Header.tsx'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className='app container'>
      <div className="row">
        <Header />
      </div>
    </div>
  )
}

export default App
