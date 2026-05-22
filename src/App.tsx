import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import CaseList from './pages/CaseList'

function App() {
  return (
    <ConfigProvider
      theme={{ token: { colorPrimary: '#3b82f6' } }}
      locale={zhCN}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CaseList />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>  
    </ConfigProvider>
  )
}

export default App
