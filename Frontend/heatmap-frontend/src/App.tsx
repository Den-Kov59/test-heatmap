import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [image, setImage] = useState('');
  useEffect(() => {
    fetch('http://localhost:3000/').then((response) => {
      return response.json();
    }).then((data) => {      
      setImage(data.image)
    }
    )
  }, [])
  
  return (
    <>
      <img src={'data:image/png;base64, ' + image} />
    </>
  )
}

export default App
