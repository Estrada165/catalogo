import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import { APP_NAME } from './lib/supabase'
import './styles/tokens.css'
import './styles/base.css'
import './styles/app.css'
import './styles/panel.css'

document.title = APP_NAME

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
